"""Nonblocking native picker and bounded, process-local file selection capabilities."""
import json
import secrets
import subprocess
import sys
import time
from pathlib import Path
from file_reader import selected_file, DirectoryAnchor
from project_context import project_roots, local_directory

SESSION_KEY = 'workspaceSession'
MAX_AGE = 24 * 60 * 60


def response(data):
    return {'content': [{'type': 'text', 'text': 'file-workspace 文件选择状态。'}],
            'structuredContent': data}


class WorkspaceLauncher:
    def __init__(self):
        self.sessions = {}
        self.picker = None

    def prune(self):
        now = time.monotonic()
        self.sessions = {key: value for key, value in self.sessions.items() if now - value[1] < MAX_AGE}
        if self.picker and now - self.picker['started'] > 600:
            proc = self.picker['process']
            if proc.poll() is None:
                proc.kill()
            proc.communicate(timeout=5)
            self.picker = None

    def begin(self, kind='file'):
        self.prune()
        if kind not in ('file','directory'):raise ValueError('选择类型无效')
        if self.picker:
            raise ValueError('已有文件选择框，请先选择或取消；关闭后可重试。')
        proc = subprocess.Popen([sys.executable, '-B', str(Path(__file__).with_name('native_picker.py')), kind],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        ticket = secrets.token_urlsafe(32)
        self.picker = {'ticket': ticket, 'process': proc, 'started': time.monotonic(), 'kind':kind}
        return response({'pending': True, 'ticket': ticket})

    def poll(self, ticket):
        self.prune()
        if not self.picker or not isinstance(ticket, str) or ticket != self.picker['ticket']:
            raise ValueError('文件选择已结束或超时，请重新点击打开文件。')
        proc = self.picker['process']
        if proc.poll() is None:
            return response({'pending': True})
        kind=self.picker.get('kind','file')
        self.picker = None
        output, _ = proc.communicate(timeout=5)
        if proc.returncode:
            raise ValueError('本机文件选择框未能启动，请从原生文件标签打开。')
        data = json.loads(output.decode('utf-8'))
        if data.get('cancelled'):
            return response({'cancelled': True})
        if data.get('error'):
            raise ValueError(data['error'])
        # Only the native dialog result can establish an anchor. UI-provided paths cannot.
        path = local_directory(data.get('path')) if kind=='directory' else selected_file({'_meta': {'openai/resource': {'path': data.get('path')}}})
        return self.grant(path,kind)

    def grant(self, path, kind):
        token = secrets.token_urlsafe(32)
        if len(self.sessions) >= 64:
            self.sessions.pop(next(iter(self.sessions)))
        self.sessions[token] = (str(path), time.monotonic(), kind)
        return response({('directory' if kind=='directory' else 'file'): {'name': path.name or str(path), 'path': str(path), 'kind':kind,
                                  'resourceUri': 'file-workspace://selected/' + secrets.token_urlsafe(12)},
                         'session': token})

    def start(self, params):
        self.prune()
        paths=project_roots(params)
        if not paths:return response({'needsDirectory':True,'roots':[]})
        roots=[self.grant(path,'directory')['structuredContent'] for path in paths]
        return response({**roots[0],'roots':roots})

    def authorize(self, params):
        token = (params.get('arguments') or {}).get(SESSION_KEY)
        if token is None:
            return params
        self.prune()
        selection = self.sessions.get(token) if isinstance(token, str) else None
        if not selection:
            raise ValueError('打开文件的会话已失效，请点击打开文件重新选择。')
        kind=selection[2] if len(selection)>2 else 'file'
        self.sessions[token] = (selection[0], time.monotonic(), kind)
        if kind=='directory':return {**params,'_workspace_directory':DirectoryAnchor(Path(selection[0]))}
        return {**params, '_meta': {**(params.get('_meta') or {}),
                                   'openai/resource': {'path': selection[0]}}}

    def cancel(self, ticket):
        if not self.picker or not isinstance(ticket, str) or ticket != self.picker['ticket']:
            return response({'cancelled': False})
        proc = self.picker['process']
        self.picker = None
        if proc.poll() is None:
            proc.kill()
        proc.communicate(timeout=5)
        return response({'cancelled': True})
