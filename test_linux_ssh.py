"""Linux/SSH adapter regressions using only isolated test-owned files."""
import os
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from directory_reader import list_directory
from directory_writer import create_directory
from file_reader import DirectoryAnchor, read_file
from file_writer import save_markdown
from image_reader import read_images
from project_context import project_roots
from workspace_launcher import WorkspaceLauncher


class SshTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'project'
        self.root.mkdir()
        self.note = self.root / '笔记 空格.md'
        self.note.write_text('# Test\n', encoding='utf-8')
        self.env = patch.dict(os.environ, {'FILE_WORKSPACE_ALLOWED_ROOT': str(self.root),
            'FILE_WORKSPACE_PROJECT_ROOT': str(self.root), 'FILE_WORKSPACE_HEADLESS': '1'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.params = {'_workspace_directory': DirectoryAnchor(self.root), 'arguments': {}}

    def test_fallback_without_host_thread_metadata(self):
        result = WorkspaceLauncher().start({})['structuredContent']
        self.assertEqual(result['directory']['path'], str(self.root))
        self.assertTrue(result['session'])

    def test_codex_home_and_current_thread_take_precedence(self):
        state = self.base / 'codex-state'
        state.mkdir()
        nested = self.root / 'nested'
        nested.mkdir()
        thread = '11111111-1111-4111-8111-111111111111'
        with closing(sqlite3.connect(state / 'state_5.sqlite')) as con:
            con.execute('CREATE TABLE threads(id TEXT PRIMARY KEY, cwd TEXT)')
            con.execute('INSERT INTO threads VALUES(?,?)', (thread, str(nested)))
            con.commit()
        with patch.dict(os.environ, {'CODEX_HOME': str(state)}):
            self.assertEqual(project_roots({'_meta': {'threadId': thread}}), [nested])

    def test_parent_escape_blocked_for_read_list_save_create(self):
        outside = self.base / 'outside.md'
        outside.write_text('# Original', encoding='utf-8')
        for operation, args in [(read_file, {'path': '../outside.md'}),
            (list_directory, {'directory': '..'}),
            (save_markdown, {'path': str(outside), 'text': '# Changed', 'revision': '0'*64}),
            (create_directory, {'parent': str(self.base), 'name': 'must-not-exist'})]:
            with self.subTest(operation=operation.__name__):
                with self.assertRaisesRegex(ValueError, '工作区范围'):
                    operation({**self.params, 'arguments': args})
        self.assertEqual(outside.read_text(), '# Original')
        self.assertFalse((self.base / 'must-not-exist').exists())

    def test_symlink_escape_and_embedded_image_blocked(self):
        outside = self.base / 'outside.svg'
        outside.write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        link = self.root / 'escape.svg'
        try:
            link.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest('This host does not permit creating symlinks')
        self.note.write_text('![escape](escape.svg)\n![parent](../outside.svg)')
        with self.assertRaisesRegex(ValueError, '工作区范围'):
            read_file({**self.params, 'arguments': {'path': 'escape.svg'}})
        images = read_images({**self.params, 'arguments': {'documentPath': str(self.note),
            'sources': ['escape.svg', '../outside.svg']}})['structuredContent']['images']
        self.assertTrue(all('error' in image and 'blob' not in image for image in images))
        self.assertNotIn('escape.svg', [entry['name'] for entry in list_directory(self.params)['structuredContent']['entries']])

    def test_boundary_root_has_no_parent_navigation(self):
        self.assertIsNone(list_directory(self.params)['structuredContent']['parent'])

    def test_headless_picker_does_not_spawn_tkinter(self):
        with patch('workspace_launcher.subprocess.Popen') as spawn:
            with self.assertRaisesRegex(ValueError, 'SSH'):
                WorkspaceLauncher().begin('directory')
            spawn.assert_not_called()


if __name__ == '__main__':
    unittest.main()
