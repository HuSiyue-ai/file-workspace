"""Persist folders explicitly pinned in the workspace UI."""
from contextlib import closing
import os
from pathlib import Path, PurePosixPath
import sqlite3
import uuid

from access_policy import checked_path
from directory_reader import list_directory
from project_context import local_directory
from workspace_launcher import response


MAX_PINS = 64


class WorkspacePins:
    def __init__(self, launcher, ssh, state_root=None):
        self.launcher = launcher
        self.ssh = ssh
        root = state_root or Path(os.environ.get('CODEX_HOME', Path.home() / '.codex'))
        self.database = root / 'file-workspace' / 'pinned-folders.sqlite3'

    def run(self, params):
        args = params.get('arguments') or {}
        action = args.get('action')
        token = args.get('workspaceSession')
        pin_id = args.get('id')
        if action not in ('list', 'pin', 'unpin', 'open'):
            raise ValueError('未知的常用文件夹操作')
        if action in ('unpin', 'open') and (not isinstance(pin_id, str) or len(pin_id) != 32):
            raise ValueError('常用文件夹标识无效')
        target = self.resolve_pin(params, args.get('path'), token) if action == 'pin' else None
        if action == 'list' and not self.database.is_file():
            return response({'pins': []})
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.database, isolation_level='IMMEDIATE')) as db, db:
            db.row_factory = sqlite3.Row
            db.execute('''CREATE TABLE IF NOT EXISTS pins (
                id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT NOT NULL,
                host TEXT NOT NULL, profile TEXT NOT NULL, root TEXT NOT NULL,
                UNIQUE(profile, root, host, path)
            )''')
            if action == 'pin':
                path, name, host, profile, root = target
                db.execute('''INSERT OR IGNORE INTO pins
                    SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM pins) < ?''',
                    (uuid.uuid4().hex, path, name, host, profile, root, MAX_PINS))
                if not db.execute('SELECT 1 FROM pins WHERE profile=? AND root=? AND host=? AND path=?',
                                  (profile, root, host, path)).fetchone():
                    raise ValueError('常用文件夹已达上限，请先取消固定一个文件夹')
            elif action == 'unpin':
                db.execute('DELETE FROM pins WHERE id=?', (pin_id,))
            elif action == 'open':
                row = db.execute('SELECT * FROM pins WHERE id=?', (pin_id,)).fetchone()
                if row is None:
                    raise ValueError('这个文件夹已取消固定，请重新打开菜单')
                return self.open_pin(row)
            return response({'pins': [
                {key: row[key] for key in ('id', 'path', 'name', 'host', 'profile')}
                for row in db.execute('SELECT * FROM pins ORDER BY rowid')
            ]})

    def resolve_pin(self, params, path, token):
        if not isinstance(path, str) or not path or len(path) > 8192:
            raise ValueError('请选择要固定的文件夹')
        request = {**params, 'name': 'list_markdown_directory',
                   'arguments': {'directory': path, 'workspaceSession': token}}
        profile = self.ssh.tokens.get(token) if isinstance(token, str) else None
        if profile is None:
            # Require the same host metadata or selection capability as a tree read.
            canonical = list_directory(self.launcher.authorize(request))['structuredContent']['directory']
            return canonical, Path(canonical).name or canonical, '', '', ''
        self.remote_path(path, profile)
        result = self.ssh.route(request)
        if result.get('isError'):
            raise ValueError(next((item['text'] for item in result.get('content', [])
                                   if item.get('type') == 'text'), '无法读取服务器目录'))
        canonical = result.get('structuredContent', {}).get('directory')
        self.remote_path(canonical, profile)
        return canonical, PurePosixPath(canonical).name or canonical, profile['host'], profile['id'], profile['root']

    @staticmethod
    def remote_path(path, profile):
        if not isinstance(path, str):
            raise ValueError('未收到服务器目录')
        target = PurePosixPath(path)
        if '..' in target.parts or not target.is_relative_to(profile['root']):
            raise ValueError('请选择已配置的服务器共享目录内的文件夹')

    def open_pin(self, row):
        if not row['profile']:
            path = checked_path(local_directory(row['path']))
            if os.path.normcase(str(path)) != os.path.normcase(row['path']):
                raise ValueError('固定目录已指向其他位置，请重新固定')
            return self.launcher.grant(path, 'directory')
        for token, profile in self.ssh.tokens.items():
            if (profile['id'], profile['host'], profile['root']) == (row['profile'], row['host'], row['root']):
                self.remote_path(row['path'], profile)
                return response({'directory': {
                    'name': row['name'], 'path': row['path'], 'kind': 'directory', 'host': row['host'],
                    'resourceUri': 'file-workspace://ssh/' + row['profile'],
                }, 'session': token})
        raise ValueError('固定目录对应的 SSH 入口已更改，请重新选择并固定')
