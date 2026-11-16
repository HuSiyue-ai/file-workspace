"""仅显式保存当前磁盘上的 Markdown，校验版本并保留原文件备份。"""
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from file_reader import selected_file, MARKDOWN, MAX_TEXT_BYTES

BACKUP_ROOT = Path(os.environ.get('FILE_WORKSPACE_BACKUP_ROOT', str(Path.home() / '.codex' / 'backups' / 'file-preview')))
SAVE_LOCK = threading.Lock()


def revision(data):
    return hashlib.sha256(data).hexdigest()


def save_markdown(params):
    args = params.get('arguments') or {}
    content, expected = args.get('text'), args.get('revision')
    if not isinstance(content, str) or '\0' in content:
        raise ValueError('保存内容必须是有效的 Markdown 文本')
    if not isinstance(expected, str) or len(expected) != 64:
        raise ValueError('缺少读取时的文件版本，请重新读取后再编辑')
    if len(content.encode('utf-8')) > MAX_TEXT_BYTES:
        raise ValueError('Markdown 超过 8 MB，未保存')
    with SAVE_LOCK:
        path = selected_file(params, args.get('path'))
        if path.suffix.lower() not in MARKDOWN:
            raise ValueError('编辑保存仅支持 .md 和 .markdown 文件')
        info = path.stat()
        if info.st_size > MAX_TEXT_BYTES or info.st_nlink > 1:
            raise ValueError('文件过大或存在硬链接，无法安全保存')
        original = path.read_bytes()
        if revision(original) != expected:
            raise ValueError('文件已被其他程序修改，未覆盖。请先复制你的修改，再刷新文件重新编辑。')
        try:
            old_text = original.decode('utf-8-sig')
        except UnicodeDecodeError:
            raise ValueError('文件不是 UTF-8，未保存') from None
        # textarea 使用 LF；原文件统一为 CRLF 时保存为 CRLF，同时保留 BOM。
        normalized = content.replace('\r\n', '\n').replace('\r', '\n')
        if '\r\n' in old_text and '\n' not in old_text.replace('\r\n', ''):
            normalized = normalized.replace('\n', '\r\n')
        data = (b'\xef\xbb\xbf' if original.startswith(b'\xef\xbb\xbf') else b'') + normalized.encode('utf-8')
        if len(data) > MAX_TEXT_BYTES:
            raise ValueError('保存后的文件超过 8 MB，未保存')
        if data == original:
            return {'content':[{'type':'text','text':'内容没有变化。'}], 'structuredContent':{'path':str(path),'revision':expected,'saved':True}}
        BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
        key = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex
        backup = BACKUP_ROOT / (key + '.md.bak')
        backup.write_bytes(original)
        backup.with_suffix('.json').write_text(json.dumps({'originalPath':str(path),'revision':expected}, ensure_ascii=False), encoding='utf-8')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix='.'+path.name+'.', suffix='.tmp', dir=path.parent, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary, stat.S_IMODE(info.st_mode))
            if revision(path.read_bytes()) != expected:
                raise ValueError('保存期间文件被其他程序修改，未覆盖。请保留你的修改后重新读取。')
            os.replace(temporary, path)
            temporary = None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return {'content':[{'type':'text','text':'Markdown 已保存，原内容已备份。'}],
            'structuredContent':{'path':str(path),'revision':revision(data),'saved':True,'backupPath':str(backup)}}
