"""Read only the installed, completed UI build; never reload live Python modules."""
import hashlib
import json
from pathlib import Path

MAX_UI_BYTES = 24 * 1024 * 1024


def runtime_fingerprint(root):
    root = Path(root)
    files = sorted(root.glob('*.py')) + [root / '.mcp.json', root / 'ssh-workspaces.json']
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.name.encode('utf-8') + b'\0')
        digest.update(path.read_bytes() if path.is_file() else b'<absent>')
    return digest.hexdigest()


class UIUpdates:
    def __init__(self, root, version):
        self.root = Path(root)
        self.version = version
        self.loaded_runtime = runtime_fingerprint(self.root)

    def read(self):
        metadata = json.loads((self.root / 'ui-build.json').read_text(encoding='utf-8'))
        runtime = runtime_fingerprint(self.root)
        if runtime != metadata.get('runtimeHash'):
            raise ValueError('插件更新尚未完成，请稍后再试；当前页面已保留。')
        result = {'uiVersion': metadata['version'], 'backendVersion': self.version}
        if runtime != self.loaded_runtime:
            return {'structuredContent': {**result, 'restartRequired': True}, 'content': []}
        path = self.root / 'viewer.html'
        if path.stat().st_size > MAX_UI_BYTES:
            raise ValueError('插件界面超出重载大小限制；当前页面已保留。')
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != metadata.get('uiHash'):
            raise ValueError('插件界面正在更新或校验失败，请稍后再试；当前页面已保留。')
        if runtime_fingerprint(self.root) != runtime or json.loads((self.root / 'ui-build.json').read_text(encoding='utf-8')) != metadata:
            raise ValueError('插件正在更新，请稍后再试；当前页面已保留。')
        return {'structuredContent': {**result, 'restartRequired': False,
                                     'html': data.decode('utf-8'), 'uiHash': metadata['uiHash']}, 'content': []}
