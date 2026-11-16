"""Explicit creation, reveal and bounded binary copies for a selected workspace."""
import atexit
import base64
from dataclasses import dataclass
import os
from pathlib import Path
import secrets
import stat
import tempfile
import time
from typing import BinaryIO

from directory_writer import folder_name, writable_parent
from file_reader import MARKDOWN, TEXT
from image_reader import filesystem_path

CHUNK_BYTES = 512 * 1024
MAX_COPY_BYTES = 256 * 1024 * 1024


def reply(data):
    return {'content': [], 'structuredContent': data}


def entry_name(value):
    try:
        return folder_name(value)
    except ValueError as error:
        raise ValueError(str(error).replace('文件夹名称', '文件名')) from None


def result(path):
    return reply({'path': str(path), 'name': path.name, 'parent': str(path.parent), 'created': True})


def create_file(params):
    args = params['arguments']
    target = writable_parent(params, args.get('parent')) / entry_name(args.get('name'))
    try:
        with target.open('xb'):
            pass
    except FileExistsError:
        raise ValueError('已有同名文件或文件夹') from None
    response = result(target)
    response['structuredContent']['previewable'] = target.suffix.lower() in MARKDOWN | TEXT
    return response


def workspace_file(params, value):
    if not isinstance(value, str) or not value or len(value) > 8192:
        raise ValueError('文件路径无效')
    path = filesystem_path(value)
    if not path.is_absolute() or '..' in path.parts or not path.name:
        raise ValueError('文件路径无效')
    path = writable_parent(params, str(path.parent)) / path.name
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        raise ValueError('此操作仅支持普通文件')
    return path


def reveal_file(params):
    if os.name != 'nt' or os.environ.get('FILE_WORKSPACE_HEADLESS') == '1':
        raise ValueError('当前环境无法打开 Windows 资源管理器')
    import ctypes
    from ctypes import wintypes

    path = workspace_file(params, params['arguments'].get('path'))
    ole, shell = ctypes.windll.ole32, ctypes.windll.shell32
    shell.ILCreateFromPathW.argtypes = [wintypes.LPCWSTR]
    shell.ILCreateFromPathW.restype = ctypes.c_void_p
    shell.ILFree.argtypes = [ctypes.c_void_p]
    shell.SHOpenFolderAndSelectItems.argtypes = [ctypes.c_void_p, wintypes.UINT, ctypes.c_void_p, wintypes.DWORD]
    shell.SHOpenFolderAndSelectItems.restype = ctypes.c_long
    ole.CoInitialize.argtypes = [ctypes.c_void_p]
    ole.CoInitialize.restype = ctypes.c_long
    if ole.CoInitialize(None) < 0:
        raise ValueError('无法初始化资源管理器')
    try:
        item = shell.ILCreateFromPathW(str(path))
        if not item:
            raise ValueError('无法定位该文件')
        try:
            if shell.SHOpenFolderAndSelectItems(item, 0, None, 0) < 0:
                raise ValueError('资源管理器无法打开此位置')
        finally:
            shell.ILFree(item)
    finally:
        ole.CoUninitialize()
    return reply({'opened': True})


def file_revision(info):
    return f'{info.st_dev}:{info.st_ino}:{info.st_size}:{info.st_mtime_ns}:{info.st_ctime_ns}'


def read_copy(params):
    args = params['arguments']
    path = workspace_file(params, args.get('path'))
    offset = args.get('offset')
    if type(offset) is not int or offset < 0:
        raise ValueError('复制位置无效')
    flags = os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
    with os.fdopen(os.open(path, flags), 'rb') as stream:
        info = os.fstat(stream.fileno())
        revision = file_revision(info)
        if not stat.S_ISREG(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise ValueError('此操作仅支持普通文件')
        if info.st_size > MAX_COPY_BYTES:
            raise ValueError('单个文件不能超过 256 MiB')
        if offset > info.st_size or (offset or args.get('revision') is not None) and args.get('revision') != revision:
            raise ValueError('源文件已改变，请重新导出')
        stream.seek(offset)
        data = stream.read(min(CHUNK_BYTES, info.st_size - offset))
        if file_revision(os.fstat(stream.fileno())) != revision:
            raise ValueError('源文件在复制时改变，请重新导出')
    return reply({'name': path.name, 'size': info.st_size, 'revision': revision,
                  'offset': offset + len(data), 'data': base64.b64encode(data).decode('ascii')})


@dataclass
class PendingCopy:
    target: Path
    temporary: Path
    size: int
    offset: int
    touched: float
    owner: str | None
    stream: BinaryIO


class FileCopies:
    def __init__(self):
        self.pending = {}
        atexit.register(self.close)

    def discard(self, ticket):
        copy = self.pending.pop(ticket, None)
        if copy:
            try:
                identity = os.fstat(copy.stream.fileno()) if not copy.stream.closed else None
                copy.stream.close()
                if identity is not None and not os.path.samestat(identity, copy.temporary.lstat()):
                    return
                copy.temporary.unlink(missing_ok=True)
            except OSError:
                pass

    def close(self):
        for ticket in list(self.pending):
            self.discard(ticket)

    def prune(self, now):
        for ticket, copy in list(self.pending.items()):
            if now - copy.touched > 600:
                self.discard(ticket)

    def write(self, params):
        args = params['arguments']
        now = time.monotonic()
        self.prune(now)
        action = args.get('action')
        owner = args.get('workspaceSession')
        if action == 'begin':
            if len(self.pending) >= 8:
                raise ValueError('当前有过多未结束的文件复制')
            size = args.get('size')
            if type(size) is not int or not 0 <= size <= MAX_COPY_BYTES:
                raise ValueError('单个文件不能超过 256 MiB')
            target = writable_parent(params, args.get('parent')) / entry_name(args.get('name'))
            if os.path.lexists(target):
                raise ValueError('已有同名文件或文件夹')
            stream = tempfile.NamedTemporaryFile(dir=target.parent, prefix='.file-workspace-', suffix='.part', delete=False)
            ticket = secrets.token_urlsafe(24)
            self.pending[ticket] = PendingCopy(target, Path(stream.name), size, 0, now, owner, stream)
            return reply({'ticket': ticket, 'chunkBytes': CHUNK_BYTES})

        ticket = args.get('ticket')
        copy = self.pending.get(ticket) if isinstance(ticket, str) else None
        if not copy or copy.owner != owner:
            raise ValueError('文件复制已结束或会话已失效')
        if action == 'abort':
            self.discard(ticket)
            return reply({'aborted': True})
        writable_parent(params, str(copy.target.parent))
        if action == 'append':
            data = args.get('data')
            if not isinstance(data, str) or len(data) > ((CHUNK_BYTES + 2) // 3) * 4:
                raise ValueError('复制分块大小无效')
            data = base64.b64decode(data, validate=True)
            if args.get('offset') != copy.offset or not 0 < len(data) <= CHUNK_BYTES or copy.offset + len(data) > copy.size:
                raise ValueError('复制分块位置或大小无效')
            copy.stream.seek(copy.offset)
            copy.stream.write(data)
            copy.offset += len(data)
            copy.touched = now
            return reply({'offset': copy.offset})
        if action == 'finish':
            if copy.offset != copy.size:
                raise ValueError('文件尚未完整传输')
            copy.stream.flush()
            if not os.path.samestat(os.fstat(copy.stream.fileno()), copy.temporary.lstat()):
                raise ValueError('临时文件已改变，请重新复制')
            copy.stream.close()
            try:
                # Both operations fail atomically if a competing writer created the destination.
                if os.name == 'nt':
                    copy.temporary.rename(copy.target)
                else:
                    os.link(copy.temporary, copy.target)
            except FileExistsError:
                raise ValueError('已有同名文件或文件夹') from None
            finally:
                self.discard(ticket)
            return result(copy.target)
        raise ValueError('未知的文件复制操作')
