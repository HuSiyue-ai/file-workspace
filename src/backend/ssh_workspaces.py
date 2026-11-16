"""Opt-in SSH roots. UI paths never become shell commands; writes are never retried."""
import atexit
import json
import os
import posixpath
from pathlib import Path, PurePosixPath
import queue
import re
import secrets
import shlex
import subprocess
import threading
import time

TOOLS = frozenset({'read_preview_file', 'list_markdown_directory', 'read_markdown_images',
                   'save_markdown_file', 'read_pdf_preview', 'create_workspace_directory',
                   'create_workspace_file', 'recycle_workspace_file', 'read_workspace_copy', 'write_workspace_copy'})
MAX_RESPONSE = 64 * 1024 * 1024


def profiles_from(path):
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, list) or len(data) > 8:
        raise ValueError('SSH 工作区配置必须是最多 8 个入口的数组')
    ids = set()
    for item in data:
        if not isinstance(item, dict) or set(item) - {'id', 'label', 'host', 'root', 'python', 'server', 'backupRoot'}:
            raise ValueError('SSH 工作区配置字段无效')
        for key in ('id', 'host'):
            if not isinstance(item.get(key), str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}', item[key]):
                raise ValueError('SSH 入口只能使用已配置的主机别名')
        if item['id'] in ids:
            raise ValueError('SSH 工作区标识重复')
        ids.add(item['id'])
        if not isinstance(item.get('label'), str) or not 1 <= len(item['label']) <= 100:
            raise ValueError('SSH 工作区名称无效')
        for key in ('root', 'python', 'server', 'backupRoot'):
            value = item.get(key)
            if key == 'backupRoot' and value is None:
                continue
            if not isinstance(value, str) or len(value) > 4096 or '\0' in value or '\n' in value or not value.startswith('/') or '..' in PurePosixPath(value).parts:
                raise ValueError('SSH 运行环境必须使用明确的绝对路径')
        if item.get('backupRoot') and not PurePosixPath(item['backupRoot']).is_relative_to(item['root']):
            raise ValueError('远程备份目录必须位于共享目录内')
    return data


class SSHConnection:
    def __init__(self, profile, timeout=25):
        self.profile = profile
        self.timeout = timeout
        self.process = None
        self.session = None
        self.counter = 0
        self.lock = threading.Lock()

    def close(self):
        proc, self.process, self.session = self.process, None, None
        if proc:
            if proc.poll() is None:
                proc.kill()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
            for stream in (proc.stdin, proc.stdout):
                if stream:
                    stream.close()

    def command(self):
        p = self.profile
        env = {'PYTHONIOENCODING': 'utf-8', 'FILE_WORKSPACE_HEADLESS': '1',
               'FILE_WORKSPACE_PROJECT_ROOT': p['root'], 'FILE_WORKSPACE_ALLOWED_ROOT': p['root']}
        if p.get('backupRoot'):
            env['FILE_WORKSPACE_BACKUP_ROOT'] = p['backupRoot']
        remote = ['env', *[key+'='+value for key, value in env.items()], p['python'], '-B', p['server']]
        # Only administrator/user-authored profile values enter this command.
        # Document paths/content travel through JSON stdin, never the shell.
        return ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=10',
                '-o', 'ServerAliveCountMax=2', self.profile['host'], shlex.join(remote)]

    def exchange(self, method, params):
        self.counter += 1
        ident = self.counter
        proc = self.process
        payload = (json.dumps({'jsonrpc': '2.0', 'id': ident, 'method': method, 'params': params},
                              ensure_ascii=False, separators=(',', ':'))+'\n').encode('utf-8')
        result = queue.Queue(maxsize=1)

        def communicate():
            try:
                proc.stdin.write(payload)
                proc.stdin.flush()
                line = proc.stdout.readline(MAX_RESPONSE+1)
                if not line or len(line) > MAX_RESPONSE:
                    raise OSError('SSH response missing or too large')
                reply = json.loads(line)
                if reply.get('id') != ident or reply.get('jsonrpc') != '2.0':
                    raise OSError('SSH response identity mismatch')
                result.put((reply, None))
            except Exception as error:
                result.put((None, error))

        threading.Thread(target=communicate, daemon=True).start()
        try:
            reply, error = result.get(timeout=max(.001,min(self.timeout,self.deadline-time.monotonic())))
        except queue.Empty:
            raise ConnectionError('SSH 请求超时') from None
        if error:
            raise ConnectionError('SSH 通道中断，请检查主机连接与远程插件运行环境') from error
        if 'error' in reply:
            raise ValueError(reply['error'].get('message', '远程文件操作失败'))
        return reply.get('result', {})

    def connect(self):
        if self.process and self.process.poll() is None and self.session:
            return
        self.close()
        self.process = subprocess.Popen(self.command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        info = self.exchange('initialize', {'protocolVersion': '2025-11-25', 'capabilities': {},
                                     'clientInfo': {'name': 'file-workspace-ssh', 'version': '1'}})
        version = re.match(r'^(\d+)\.(\d+)\.(\d+)', str(info.get('serverInfo', {}).get('version', '')))
        if not version or tuple(map(int, version.groups())) < (1, 9, 0):
            raise ConnectionError('远程后端需升级到 file-workspace 1.9.0 或更高版本')
        data = self.exchange('tools/call', {'name': 'get_workspace_start', 'arguments': {}})
        start = data.get('structuredContent', {})
        if data.get('isError') or start.get('directory', {}).get('path') != self.profile['root'] or not start.get('session'):
            raise ConnectionError('远程插件未返回指定的共享目录')
        self.session = start['session']

    def call(self, name, arguments):
        with self.lock:
            self.deadline = time.monotonic()+45
            try:
                self.connect()
                return self.exchange('tools/call', {'name': name,
                    'arguments': {**arguments, 'workspaceSession': self.session}})
            except ValueError:
                # An ordinary access/conflict error keeps the transport usable.
                raise
            except Exception as error:
                self.close()
                suffix = '；保存结果可能未知，请保留草稿，重新读取文件确认后再保存。' if name == 'save_markdown_file' else '；可检查 '+self.profile['host']+' 的 SSH 连接后重新尝试。'
                raise ValueError(str(error)+suffix) from None


class SSHWorkspaces:
    def __init__(self, config=None):
        # This private machine-specific file is optional and excluded from Git.
        self.config_error = None
        try:
            self.profiles = profiles_from(config or Path(__file__).with_name('ssh-workspaces.json'))
        except (ValueError, OSError) as error:
            self.profiles = []
            self.config_error = str(error)
        self.connections = {}
        self.tokens = {}
        for profile in self.profiles:
            self.tokens[secrets.token_urlsafe(32)] = profile
        atexit.register(self.close)

    def close(self):
        for connection in self.connections.values():
            connection.close()

    def choices(self):
        return [{'directory': {'name': p['label'], 'path': p['root'], 'kind': 'directory',
                    'host': p['host'], 'resourceUri': 'file-workspace://ssh/'+p['id']}, 'session': token}
                for token, p in self.tokens.items()]

    def extend_start(self, result):
        data = result['structuredContent']
        return {**result, 'structuredContent': {**data, 'roots': [*data.get('roots', []), *self.choices()], **({'sshConfigError': self.config_error} if self.config_error else {})}}

    def host_file_choice(self, params):
        """Resolve only the host-selected file, never arbitrary UI arguments."""
        args = params.get('arguments') or {}
        if params.get('name') != 'read_preview_file' or args.get('workspaceSession') is not None or args.get('path') is not None:
            return None
        path = ((params.get('_meta') or {}).get('openai/resource') or {}).get('path')
        if not isinstance(path, str) or len(path) > 8192 or '\0' in path or not path.startswith('/') or path.startswith('//'):
            return None
        canonical = posixpath.normpath(path)
        matches = [choice for choice in self.choices()
                   if PurePosixPath(canonical).is_relative_to(choice['directory']['path'])]
        if not matches:
            return None
        longest = max(len(choice['directory']['path']) for choice in matches)
        matches = [choice for choice in matches if len(choice['directory']['path']) == longest]
        if len(matches) != 1:
            raise ValueError('这个路径匹配多个 SSH 入口，请从文件树明确选择服务器。')
        return matches[0], canonical

    def route(self, params):
        args = params.get('arguments') or {}
        automatic = self.host_file_choice(params)
        if automatic:
            choice, path = automatic
            result = self.route({**params, 'arguments': {'path': path, 'workspaceSession': choice['session']}})
            if not result.get('isError'):
                return {**result, 'structuredContent': {**result.get('structuredContent', {}), 'workspace': choice}}
            return result
        profile = self.tokens.get(args.get('workspaceSession')) if isinstance(args.get('workspaceSession'), str) else None
        if profile is None:
            return None
        if params.get('name') not in TOOLS:
            raise ValueError('此操作不支持 SSH 工作区')
        connection = self.connections.setdefault(profile['id'], SSHConnection(profile))
        result = connection.call(params['name'], {k: v for k, v in args.items() if k != 'workspaceSession'})
        return {**result, 'structuredContent': {**result.get('structuredContent', {}), 'host': profile['host']}}
