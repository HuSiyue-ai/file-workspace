"""Recoverable file-tree deletion on Windows and configured SSH roots."""
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import time

from access_policy import allowed_root, checked_path
from directory_writer import plain_parent, writable_parent
from file_operations import file_revision, reply, workspace_file


def recycle_windows(path):
    import ctypes as c
    from ctypes import wintypes as w
    from uuid import UUID

    pointer = c.c_void_p
    hresult = c.c_long
    shell, ole = c.windll.shell32, c.windll.ole32
    drive_type = c.windll.kernel32.GetDriveTypeW
    drive_type.argtypes = [w.LPCWSTR]
    if drive_type(path.anchor) != 3:
        raise ValueError('此磁盘不支持从插件移到 Windows 回收站')

    def guid(value):
        return (c.c_ubyte * 16).from_buffer_copy(UUID(value).bytes_le)

    def check(code):
        if code < 0:
            raise ValueError(f'Windows 无法将此文件移到回收站（0x{code & 0xffffffff:08X}）')

    def call(obj, slot, result, types=(), *args):
        table = c.cast(obj, c.POINTER(c.POINTER(pointer)))[0]
        return c.WINFUNCTYPE(result, pointer, *types)(table[slot])(obj, *args)

    clsid = guid('3ad05575-8857-4850-9277-11b85bdb8e09')
    iid_operation = guid('947aab5f-0a5c-4c13-b4d6-4bf7836fc9f8')
    iid_item = guid('43826d1e-e718-42ee-bc55-a1e261c37bfe')
    ole.CoInitialize.argtypes = [pointer]
    ole.CoInitialize.restype = hresult
    ole.CoCreateInstance.argtypes = [pointer, pointer, w.DWORD, pointer, c.POINTER(pointer)]
    ole.CoCreateInstance.restype = hresult
    shell.SHCreateItemFromParsingName.argtypes = [w.LPCWSTR, pointer, pointer, c.POINTER(pointer)]
    shell.SHCreateItemFromParsingName.restype = hresult
    item, operation = pointer(), pointer()
    check(ole.CoInitialize(None))
    try:
        check(shell.SHCreateItemFromParsingName(str(path), None, iid_item, c.byref(item)))
        check(ole.CoCreateInstance(clsid, None, 1, iid_operation, c.byref(operation)))
        # IFileOperation: recycle, stop on errors, and avoid copying connected items.
        flags = 0x00080000 | 0x00100000 | 0x0400 | 0x2000 | 0x0004
        check(call(operation, 5, hresult, (w.DWORD,), flags))  # SetOperationFlags
        check(call(operation, 18, hresult, (pointer, pointer), item, None))  # DeleteItem
        check(call(operation, 21, hresult))  # PerformOperations
        aborted = w.BOOL()
        check(call(operation, 22, hresult, (c.POINTER(w.BOOL),), c.byref(aborted)))
        if aborted.value or os.path.lexists(path):
            raise ValueError('Windows 未将文件移到回收站，请检查磁盘和文件状态')
    finally:
        if operation:
            call(operation, 2, w.ULONG)
        if item:
            call(item, 2, w.ULONG)
        ole.CoUninitialize()


def remote_bin(create=False):
    root = allowed_root()
    backup = os.environ.get('FILE_WORKSPACE_BACKUP_ROOT')
    if root is None or not backup:
        raise ValueError('此工作区尚未配置可恢复的文件回收目录')
    target = Path(backup) / 'deleted-files'
    if not target.is_absolute() or not target.is_relative_to(root) or '..' in target.parts:
        raise ValueError('回收目录必须位于服务器共享目录内')
    checked_path(target)
    # Check existing ancestors before making directories through any of them.
    existing = target
    while not os.path.lexists(existing):
        existing = existing.parent
    plain_parent(existing)
    if create:
        target.mkdir(mode=0o700, parents=True, exist_ok=True)
    return plain_parent(target) if os.path.lexists(target) else target


def reject_bin_path(path, folder):
    if path.is_relative_to(folder):
        raise ValueError('请通过文件树的「恢复已删除文件」管理回收目录')


def archive_file(path, revision):
    folder = remote_bin(create=True)
    reject_bin_path(path, folder)
    if file_revision(path.lstat()) != revision:
        raise ValueError('文件已改变，请重新打开删除对话框')
    entry = Path(tempfile.mkdtemp(prefix='file-', dir=folder))
    record = entry / 'original.json'
    payload = entry / 'contents'
    try:
        record.write_text(json.dumps({'path': str(path), 'deleted': time.time()}, ensure_ascii=False), encoding='utf-8')
        path.rename(payload)  # Cross-filesystem moves fail without removing the source.
    except OSError:
        record.unlink(missing_ok=True)
        entry.rmdir()
        raise ValueError('无法移入服务器回收目录，请检查权限或文件是否在同一文件系统') from None


def read_entry(entry):
    if entry.is_symlink() or not entry.is_dir() or not re.fullmatch(r'file-[a-z0-9_]{8}', entry.name):
        return None
    payload, metadata = entry / 'contents', entry / 'original.json'
    try:
        if not stat.S_ISREG(payload.lstat().st_mode) or not stat.S_ISREG(metadata.lstat().st_mode):
            return None
        record = json.loads(metadata.read_text(encoding='utf-8'))
        path = record['path']
        if not isinstance(path, str) or not Path(path).is_absolute() or '..' in Path(path).parts:
            return None
        return {'id': entry.name, 'path': path, 'name': Path(path).name, 'deleted': float(record['deleted'])}
    except (OSError, ValueError, TypeError, KeyError):
        return None


def restore_file(params, folder, item_id):
    if not isinstance(item_id, str) or not re.fullmatch(r'file-[a-z0-9_]{8}', item_id):
        raise ValueError('回收记录无效')
    entry = folder / item_id
    record = read_entry(entry)
    if record is None:
        raise ValueError('这条回收记录已不存在，请重新打开恢复列表')
    original = Path(record['path'])
    try:
        target = writable_parent(params, str(original.parent)) / original.name
    except FileNotFoundError:
        raise ValueError('原文件夹已不存在，请先恢复原文件夹') from None
    reject_bin_path(target, folder)
    payload = entry / 'contents'
    try:
        # A hard link publishes the original inode without ever replacing a destination.
        os.link(payload, target, follow_symlinks=False)
    except FileExistsError:
        if not target.is_symlink() and target.is_file() and payload.samefile(target):
            pass  # Resume cleanup after the original inode was already restored.
        else:
            raise ValueError('原位置已有同名文件或文件夹，请移走后再恢复') from None
    except OSError:
        raise ValueError('无法恢复到原位置，请检查原文件夹权限和文件系统') from None
    payload.unlink(missing_ok=True)
    (entry / 'original.json').unlink(missing_ok=True)
    entry.rmdir()
    return reply({'restored': True, 'path': str(target), 'parent': str(target.parent)})


def file_recycle(params):
    args = params['arguments']
    action = args.get('action')
    windows = os.name == 'nt' and os.environ.get('FILE_WORKSPACE_HEADLESS') != '1'
    if action in ('list', 'restore'):
        if windows:
            raise ValueError('本地文件请在 Windows 回收站中恢复')
        folder = remote_bin()
        if action == 'list':
            entries = [item for entry in folder.iterdir() if (item := read_entry(entry))] if folder.is_dir() else []
            return reply({'entries': sorted(entries, key=lambda item: item['deleted'], reverse=True)})
        return restore_file(params, folder, args.get('id'))
    if action not in ('inspect', 'delete'):
        raise ValueError('未知的文件回收操作')
    try:
        path = workspace_file(params, args.get('path'))
        revision = file_revision(path.lstat())
    except FileNotFoundError:
        raise ValueError('文件已不存在，请刷新文件树') from None
    if not windows:
        reject_bin_path(path, remote_bin())
    if action == 'inspect':
        return reply({'revision': revision})
    if args.get('revision') != revision:
        raise ValueError('文件已改变，请重新打开删除对话框')
    if windows:
        recycle_windows(path)
    else:
        archive_file(path, revision)
    return reply({'deleted': True, 'path': str(path), 'parent': str(path.parent)})
