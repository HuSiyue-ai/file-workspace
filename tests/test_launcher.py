import json
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from file_reader import read_file
from workspace_launcher import WorkspaceLauncher
import server


class FakeProcess:
    def __init__(self, data, running=False, code=0):
        self.output = json.dumps(data).encode('utf-8')
        self.running = running
        self.returncode = code
        self.killed = False

    def poll(self):
        return None if self.running else self.returncode

    def communicate(self, **kwargs):
        return self.output, None

    def kill(self):
        self.killed = True
        self.running = False


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'中文 空格.md'
        self.path.write_text('# 原文\n', encoding='utf-8')
        self.launcher = WorkspaceLauncher()

    def selection(self, data=None, running=False):
        process = FakeProcess(data if data is not None else {'path': str(self.path)}, running)
        with patch('workspace_launcher.subprocess.Popen', return_value=process) as spawn:
            started = self.launcher.begin()['structuredContent']
        args, kwargs = spawn.call_args
        self.assertNotIn('shell', kwargs)
        self.assertIn('native_picker.py', args[0][-2])
        return started['ticket'], process

    def test_native_selection_grants_only_valid_token(self):
        ticket, _ = self.selection()
        result = self.launcher.poll(ticket)['structuredContent']
        token = result['session']
        params = self.launcher.authorize({'arguments': {'workspaceSession': token}})
        self.assertEqual(read_file(params)['structuredContent']['text'].replace('\r\n', '\n'), '# 原文\n')
        with self.assertRaises(ValueError):
            self.launcher.authorize({'arguments': {'workspaceSession': token+'wrong'}})
        with self.assertRaises(ValueError):
            read_file({'arguments': {'path': str(self.path)}})

    def test_cancel_retains_previous_sessions(self):
        ticket, _ = self.selection()
        self.launcher.poll(ticket)
        ticket, _ = self.selection({'cancelled': True})
        self.assertTrue(self.launcher.poll(ticket)['structuredContent']['cancelled'])
        self.assertEqual(len(self.launcher.sessions), 1)

    def test_nonblocking_pending_busy_wrong_ticket(self):
        ticket, process = self.selection(running=True)
        self.assertTrue(self.launcher.poll(ticket)['structuredContent']['pending'])
        with self.assertRaises(ValueError): self.launcher.begin()
        with self.assertRaises(ValueError): self.launcher.poll('wrong')
        self.assertIsNotNone(self.launcher.picker)
        process.running = False
        self.assertIn('session', self.launcher.poll(ticket)['structuredContent'])

    def test_expired_selection_and_sessions(self):
        ticket, process = self.selection(running=True)
        self.launcher.picker['started'] -= 601
        with self.assertRaises(ValueError): self.launcher.poll(ticket)
        self.assertTrue(process.killed)
        self.launcher.sessions['expired'] = (str(self.path), time.monotonic()-86401)
        with self.assertRaises(ValueError):
            self.launcher.authorize({'arguments': {'workspaceSession': 'expired'}})

    def test_only_own_ticket_can_cancel_picker(self):
        ticket, process = self.selection(running=True)
        self.assertFalse(self.launcher.cancel('other-tab')['structuredContent']['cancelled'])
        self.assertFalse(process.killed)
        self.assertTrue(self.launcher.cancel(ticket)['structuredContent']['cancelled'])
        self.assertTrue(process.killed)
        self.assertIsNone(self.launcher.picker)

    def test_invalid_file_and_picker_failure_grant_nothing(self):
        ticket, _ = self.selection({'path': str(self.path.with_suffix('.exe'))})
        with self.assertRaises((ValueError, OSError)): self.launcher.poll(ticket)
        ticket, process = self.selection()
        process.returncode = 1
        with self.assertRaises(ValueError): self.launcher.poll(ticket)
        self.assertFalse(self.launcher.sessions)

    def test_real_dispatch_read_save_conflict_and_directory(self):
        ticket, _ = self.selection()
        data = self.launcher.poll(ticket)['structuredContent']
        with patch.object(server, 'launcher', self.launcher):
            def call(name, **args):
                return server.dispatch('tools/call', {'name': name, 'arguments': {'workspaceSession': data['session'], **args}})['structuredContent']
            original = call('read_preview_file')
            self.assertEqual(original['name'], self.path.name)
            directory = call('list_markdown_directory')
            self.assertEqual(directory['directory'], str(self.path.parent.resolve()))
            # Store the backup only in this test's temp folder.
            import file_writer
            with patch.object(file_writer, 'BACKUP_ROOT', self.path.parent/'backups', create=True):
                saved = call('save_markdown_file', path=str(self.path), text='# 已保存', revision=original['revision'])
                self.assertTrue(saved['saved'])
                self.assertTrue(Path(saved['backupPath']).is_file())
                original = call('read_preview_file')
                self.path.write_text('# 外部修改\n', encoding='utf-8')
                with self.assertRaises(ValueError):
                    call('save_markdown_file', path=str(self.path), text='# 草稿', revision=original['revision'])
            self.assertEqual(self.path.read_text(encoding='utf-8'), '# 外部修改\n')

    def test_entrypoints_remain_separate_and_app_only(self):
        tools = server.dispatch('tools/list', {})['tools']
        file_entry = next(t for t in tools if t['name']=='open_markdown_preview')
        home_entry = next(t for t in tools if t['name']=='open_file_workspace')
        self.assertEqual(file_entry['_meta']['openai/ui']['entrypoints'][0]['type'], 'file')
        self.assertEqual(home_entry['_meta']['openai/ui']['entrypoints'], [{'type':'thread'}])
        self.assertFalse(home_entry['inputSchema']['properties'])
        self.assertTrue(all(t['_meta']['ui']['visibility']==['app'] for t in tools))


if __name__=='__main__': unittest.main()
