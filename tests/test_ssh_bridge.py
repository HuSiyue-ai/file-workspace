"""Transport regression tests: isolated subprocesses, no real SSH or user documents."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch, Mock

from ssh_workspaces import SSHConnection, SSHWorkspaces, profiles_from

PROFILE = {'id': 'test', 'label': 'Test SSH', 'host': 'test-alias', 'root': '/workspace',
           'python': '/tools/python', 'server': '/tools/server.py'}


class SSHBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root/'profiles.json'
        self.config.write_text(json.dumps([PROFILE]), encoding='utf-8')

    def test_opt_in_lazy_roots_and_local_routing(self):
        manager = SSHWorkspaces(self.config)
        self.addCleanup(manager.close)
        with patch('ssh_workspaces.subprocess.Popen') as popen:
            result = manager.extend_start({'structuredContent': {'needsDirectory': True, 'roots': []}})
            choice = result['structuredContent']['roots'][0]
            self.assertEqual(choice['directory']['host'], 'test-alias')
            self.assertIsNone(manager.route({'name': 'read_preview_file', 'arguments': {'workspaceSession': 'local-token'}}))
            popen.assert_not_called()
        self.assertEqual(manager.choices()[0]['session'], choice['session'])

    def test_invalid_profile_cannot_break_local_workspaces(self):
        for changes in [{'host': '-oProxyCommand=bad'}, {'root': '/workspace/../other'},
                        {'python': 'python'}, {'backupRoot': '/outside'}, {'host': 'a b'}]:
            self.config.write_text(json.dumps([{**PROFILE, **changes}]), encoding='utf-8')
            with self.assertRaises(ValueError):
                profiles_from(self.config)
            manager = SSHWorkspaces(self.config)
            self.assertEqual(manager.choices(), [])
            self.assertTrue(manager.config_error)

    def connection(self, slow=False):
        script = self.root/'remote.py'
        script.write_text('''import json, sys, time
for line in sys.stdin.buffer:
 r=json.loads(line.decode('utf-8')); p=r['params']; result={'serverInfo':{'version':'1.9.0'}}
 if r['method']=='tools/call':
  if p['name']=='get_workspace_start': result={'structuredContent':{'directory':{'path':'/workspace'},'session':'remote-token'}}
  elif p['name']=='save_markdown_file':
   with open(sys.argv[1], 'a') as f: f.write('write\\n')
   time.sleep(5)
  elif p['arguments'].get('path')=='conflict':
   print(json.dumps({'jsonrpc':'2.0','id':r['id'],'error':{'message':'revision conflict'}}),flush=True); continue
  else: result={'structuredContent':p['arguments']}
 print(json.dumps({'jsonrpc':'2.0','id':r['id'],'result':result}),flush=True)
''', encoding='utf-8')
        connection = SSHConnection(PROFILE, timeout=.4 if slow else 3)
        connection.command = lambda: [sys.executable, '-u', str(script), str(self.root/'writes')]
        self.addCleanup(connection.close)
        return connection

    def test_paths_and_text_travel_as_json_conflicts_preserve_channel(self):
        connection = self.connection()
        path = '/workspace/中文 $(touch pwned); "x".md'
        result = connection.call('read_preview_file', {'path': path, 'text': 'a\nb'})
        self.assertEqual(result['structuredContent'], {'path': path, 'text': 'a\nb', 'workspaceSession': 'remote-token'})
        proc = connection.process
        with self.assertRaisesRegex(ValueError, 'revision conflict'):
            connection.call('read_preview_file', {'path': 'conflict'})
        connection.call('read_preview_file', {'path': path})
        self.assertIs(connection.process, proc)
        connection.close()
        connection.call('read_preview_file', {'path': path})
        self.assertIsNot(connection.process, proc)

    def test_save_timeout_is_not_replayed_and_next_read_reconnects(self):
        connection = self.connection(slow=True)
        with self.assertRaisesRegex(ValueError, '保存结果可能未知'):
            connection.call('save_markdown_file', {'path': '/workspace/a.md', 'text': '# Changed'})
        self.assertEqual((self.root/'writes').read_text(), 'write\n')
        self.assertIsNone(connection.process)
        self.assertEqual(connection.call('read_preview_file', {'path': 'after'})['structuredContent']['path'], 'after')
        self.assertEqual((self.root/'writes').read_text(), 'write\n')

    def test_only_tool_allowlist_can_use_remote_tokens(self):
        manager = SSHWorkspaces(self.config)
        token = manager.choices()[0]['session']
        with self.assertRaisesRegex(ValueError, '不支持'):
            manager.route({'name': 'begin_workspace_file_selection', 'arguments': {'workspaceSession': token}})

    def test_strict_ssh_options_and_quoted_private_configuration(self):
        connection = SSHConnection({**PROFILE, 'server': "/workspace/space ' quote/server.py"})
        command = connection.command()
        self.assertIn('BatchMode=yes', command)
        self.assertIn('StrictHostKeyChecking=yes', command)
        self.assertIn('FILE_WORKSPACE_ALLOWED_ROOT=/workspace', command[-1])
        import shlex
        self.assertEqual(shlex.split(command[-1])[-1], "/workspace/space ' quote/server.py")

    def test_host_selected_posix_file_routes_and_grants_tree_session(self):
        manager = SSHWorkspaces(self.config)
        connection = Mock()
        connection.call.return_value = {'structuredContent': {'path': '/workspace/笔记.md', 'kind': 'markdown', 'text': '# Test'}}
        manager.connections['test'] = connection
        self.addCleanup(manager.close)
        params = {'name': 'read_preview_file', 'arguments': {},
                  '_meta': {'openai/resource': {'path': '/workspace/notes/../笔记.md'}}}
        data = manager.route(params)['structuredContent']
        self.assertEqual(data['host'], 'test-alias')
        choice = data['workspace']
        self.assertEqual(choice['session'], manager.choices()[0]['session'])
        self.assertEqual(choice['directory']['path'], '/workspace')
        self.assertEqual(connection.call.call_args.args, ('read_preview_file', {'path': '/workspace/笔记.md'}))
        manager.route({'name': 'read_markdown_images', 'arguments': {'workspaceSession': choice['session'], 'sources': ['image.png']}})
        self.assertEqual(connection.call.call_args.args[0], 'read_markdown_images')

    def test_only_initial_host_read_can_auto_route(self):
        manager = SSHWorkspaces(self.config)
        self.addCleanup(manager.close)
        for path in ['C:/workspace/a.md', '/workspace-other/a.md', '/workspace/../other/a.md', '//server/workspace/a.md', '/workspace/a\0.md']:
            self.assertIsNone(manager.host_file_choice({'name': 'read_preview_file', '_meta': {'openai/resource': {'path': path}}}))
        params = {'name': 'read_preview_file', '_meta': {'openai/resource': {'path': '/workspace/a.md'}}}
        for args in [{'path': '/workspace/a.md'}, {'workspaceSession': 'expired-token'}]:
            self.assertIsNone(manager.route({**params, 'arguments': args}))
        self.assertIsNone(manager.route({'name': 'read_preview_file', 'arguments': {'path': '/workspace/a.md'}}))
        self.assertIsNone(manager.host_file_choice({**params, 'name': 'save_markdown_file'}))

    def test_longest_root_selected_and_ambiguous_hosts_require_manual_choice(self):
        self.config.write_text(json.dumps([PROFILE, {**PROFILE, 'id': 'nested', 'host': 'nested-host', 'root': '/workspace/nested'}]), encoding='utf-8')
        manager = SSHWorkspaces(self.config)
        params = {'name': 'read_preview_file', '_meta': {'openai/resource': {'path': '/workspace/nested/a.md'}}}
        self.assertEqual(manager.host_file_choice(params)[0]['directory']['host'], 'nested-host')
        self.config.write_text(json.dumps([PROFILE, {**PROFILE, 'id': 'other', 'host': 'other-host'}]), encoding='utf-8')
        manager = SSHWorkspaces(self.config)
        with self.assertRaisesRegex(ValueError, '多个 SSH'):
            manager.host_file_choice(params)


if __name__ == '__main__':
    unittest.main()
