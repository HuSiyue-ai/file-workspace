"""Keep Codex's stdio connection open while replacing this plugin's worker."""
import hashlib
import json
import os
from pathlib import Path
from queue import Empty, Queue
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Thread

from ui_reload import MAX_UI_BYTES, runtime_fingerprint

ROOT = Path(__file__).resolve().parent
UPDATE = 'read_workspace_update'
WORKER_PREFIX = 'file-workspace/worker/'
MANAGED_FILES = ('.mcp.json', 'ssh-workspaces.json', 'VERSION', 'viewer.html', 'ui-build.json')
STARTUP_FILES = ('backend_host.py', 'ui_reload.py', '.mcp.json')
HANDSHAKE_TIMEOUT = 8


def startup_files(root):
    return tuple((root / name).read_bytes() for name in STARTUP_FILES)


def read_build(root):
    metadata_file = root / 'ui-build.json'
    manifest = json.loads(metadata_file.read_text(encoding='utf-8'))
    if runtime_fingerprint(root) != manifest['runtimeHash']:
        raise ValueError('插件更新尚未完成，请稍后再试')
    with (root / 'viewer.html').open('rb') as stream:
        html = stream.read(MAX_UI_BYTES + 1)
    if len(html) > MAX_UI_BYTES or hashlib.sha256(html).hexdigest() != manifest['uiHash']:
        raise ValueError('插件界面校验失败，请稍后再试')
    if (root / 'VERSION').read_text(encoding='utf-8').strip() != manifest['version']:
        raise ValueError('插件版本文件尚未更新完成')
    if json.loads(metadata_file.read_text(encoding='utf-8')) != manifest:
        raise ValueError('插件正在更新，请稍后再试')
    ui = html.decode('utf-8')
    if '<body>' not in ui or 'id="plugin-reload"' not in ui or 'workspace-version' not in ui:
        raise ValueError('插件界面缺少重载入口')
    return manifest, ui


class Worker:
    def __init__(self, source, manifest):
        self.directory = TemporaryDirectory(prefix='file-workspace-worker-')
        self.process = None
        self.reader = None
        self.replies = Queue()
        self.next_id = 0
        try:
            root = Path(self.directory.name)
            for name in [*(p.name for p in source.glob('*.py')), *MANAGED_FILES]:
                path = source / name
                if path.is_file():
                    shutil.copyfile(path, root / name)
            if read_build(root)[0] != manifest:
                raise ValueError('复制期间安装文件发生变化，请稍后再试')
            self.process = subprocess.Popen(
                [sys.executable, '-B', str(root / 'server.py'), '--managed-worker'],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
            self.reader = Thread(target=self.read_replies, daemon=True)
            self.reader.start()
            self.manifest = manifest
        except Exception:
            self.close()
            raise

    def read_replies(self):
        try:
            for line in self.process.stdout:
                self.replies.put(json.loads(line))
        except (OSError, ValueError) as error:
            self.replies.put(error)
        finally:
            self.replies.put(None)

    def call(self, method, params=None, timeout=None):
        self.next_id += 1
        request = {'jsonrpc': '2.0', 'id': self.next_id, 'method': method, 'params': params or {}}
        self.process.stdin.write((json.dumps(request, ensure_ascii=False) + '\n').encode('utf-8'))
        self.process.stdin.flush()
        try:
            reply = self.replies.get(timeout=timeout)
        except Empty:
            raise ValueError('插件后台响应超时') from None
        if not isinstance(reply, dict) or reply.get('id') != self.next_id or reply.get('jsonrpc') != '2.0':
            raise ValueError('插件后台未返回有效响应')
        return reply

    def check(self, method, params=None):
        reply = self.call(method, params, timeout=HANDSHAKE_TIMEOUT)
        if 'error' in reply:
            raise ValueError(reply['error']['message'])
        return reply['result']

    def close(self):
        if self.process is not None:
            self.process.stdin.close()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            if self.reader is not None:
                self.reader.join(timeout=2)
            self.process.stdout.close()
        try:
            self.directory.cleanup()
        except OSError as error:
            print(f'file-workspace: could not clean up worker files: {error}', file=sys.stderr)


class BackendHost:
    def __init__(self, root):
        self.root = root
        self.startup = startup_files(root)
        manifest, self.html = read_build(root)
        self.worker = Worker(root, manifest)
        self.initialize_params = {}
        self.initialized = None

    def switch_worker(self, manifest):
        state = self.worker.check(WORKER_PREFIX + 'snapshot')
        candidate = Worker(self.root, manifest)
        try:
            initialized = candidate.check('initialize', self.initialize_params)
            if initialized.get('serverInfo', {}).get('version') != manifest['version']:
                raise ValueError('新版插件后台返回了不匹配的版本')
            compatible = ('protocolVersion', 'capabilities')
            if self.initialized and any(initialized.get(key) != self.initialized.get(key) for key in compatible):
                raise ValueError('新版更改了连接协议，需要让 Codex 重新建立插件连接')
            for method in ('tools/list', 'resources/list', 'resources/templates/list'):
                if candidate.check(method) != self.worker.check(method):
                    raise ValueError('新版更改了工具或资源注册，需要让 Codex 重新建立插件连接')
            candidate.check(WORKER_PREFIX + 'restore', state)
            if read_build(self.root)[0] != manifest or startup_files(self.root) != self.startup:
                raise ValueError('插件安装发生变化，请稍后再试')
        except Exception:
            candidate.close()
            raise
        old_worker = self.worker
        self.worker = candidate
        self.initialized = initialized
        old_worker.close()

    def update(self, apply):
        manifest, html = read_build(self.root)
        worker_manifest = self.worker.manifest
        info = {'uiVersion': manifest['version'], 'backendVersion': worker_manifest['version'], 'restartRequired': False}
        if startup_files(self.root) != self.startup:
            return {'content': [], 'structuredContent': {**info, 'restartRequired': True}}
        if manifest['runtimeHash'] != worker_manifest['runtimeHash']:
            if not apply:
                return {'content': [], 'structuredContent': {**info, 'backendUpdateAvailable': True}}
            self.switch_worker(manifest)
            info.update(backendVersion=manifest['version'], backendReloaded=True)
        self.html = html
        return {'content': [], 'structuredContent': {**info, 'html': html, 'uiHash': manifest['uiHash']}}

    def handle(self, method, params):
        if method.startswith(WORKER_PREFIX):
            raise LookupError('Method not found')
        if method == 'tools/call' and params.get('name') == UPDATE:
            return {'result': self.update((params.get('arguments') or {}).get('apply') is True)}
        reply = self.worker.call(method, params)
        if 'error' in reply:
            return {'error': reply['error']}
        result = reply['result']
        if method == 'initialize':
            self.initialize_params, self.initialized = params, result
        if method == 'resources/read':
            for item in result.get('contents', []):
                if item.get('uri') == 'ui://markdown-math-preview/viewer.html':
                    item['text'] = self.html
        return {'result': result}


def main():
    host = BackendHost(ROOT)
    try:
        for line in sys.stdin.buffer:
            request = None
            try:
                request = json.loads(line)
                if 'id' not in request:
                    continue
                reply = host.handle(request['method'], request.get('params') or {})
            except Exception as error:
                reply = {'error': {'code': -32601 if isinstance(error, LookupError) else -32602,
                                   'message': str(error)}}
            response = {'jsonrpc': '2.0', 'id': request.get('id') if isinstance(request, dict) else None, **reply}
            sys.stdout.buffer.write((json.dumps(response, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8'))
            sys.stdout.buffer.flush()
    finally:
        host.worker.close()


if __name__ == '__main__':
    main()
