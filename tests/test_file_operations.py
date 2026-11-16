import base64
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from file_operations import CHUNK_BYTES, FileCopies, create_file, read_copy
from file_reader import DirectoryAnchor


class FileOperationsTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.folder = self.root / '目标 空格'
        self.folder.mkdir()
        self.copies = FileCopies()
        self.addCleanup(self.copies.close)

    def params(self, **args):
        return {'_workspace_directory': DirectoryAnchor(self.root), 'arguments': args}

    def write(self, **args):
        return self.copies.write(self.params(workspaceSession='test', **args))['structuredContent']

    def test_create_empty_file_preserves_extension_and_existing_contents(self):
        file = self.folder / '笔记.py'
        create_file(self.params(parent=str(self.folder), name=file.name))
        self.assertEqual(file.read_bytes(), b'')
        file.write_bytes(b'keep')
        with self.assertRaisesRegex(ValueError, '同名'):
            create_file(self.params(parent=str(self.folder), name=file.name))
        self.assertEqual(file.read_bytes(), b'keep')
        for invalid in ('../escape', 'COM1.txt', 'folder\\file'):
            with self.assertRaises(ValueError):
                create_file(self.params(parent=str(self.folder), name=invalid))

    def test_transfer_publishes_only_complete_binary_copy(self):
        payload = bytes(range(256)) * (CHUNK_BYTES // 256) + b'\xff\x00\x80'
        target = self.folder / '二进制.bin'
        ticket = self.write(action='begin', parent=str(self.folder), name=target.name, size=len(payload))['ticket']
        for offset in range(0, len(payload), CHUNK_BYTES):
            data = base64.b64encode(payload[offset:offset + CHUNK_BYTES]).decode('ascii')
            self.write(action='append', ticket=ticket, offset=offset, data=data)
            self.assertFalse(target.exists())
        self.write(action='finish', ticket=ticket)
        self.assertEqual(target.read_bytes(), payload)
        first = read_copy(self.params(path=str(target), offset=0))['structuredContent']
        second = read_copy(self.params(path=str(target), offset=first['offset'], revision=first['revision']))['structuredContent']
        self.assertEqual(base64.b64decode(first['data']) + base64.b64decode(second['data']), payload)
        target.write_bytes(b'replacement')
        with self.assertRaisesRegex(ValueError, '改变'):
            read_copy(self.params(path=str(target), offset=first['offset'], revision=first['revision']))

    def test_partial_abort_and_late_collision(self):
        ticket = self.write(action='begin', parent=str(self.folder), name='partial', size=3)['ticket']
        with self.assertRaisesRegex(ValueError, '完整'):
            self.write(action='finish', ticket=ticket)
        self.write(action='abort', ticket=ticket)
        self.assertEqual(list(self.folder.iterdir()), [])
        ticket = self.write(action='begin', parent=str(self.folder), name='collision', size=0)['ticket']
        target = self.folder / 'collision'
        target.write_bytes(b'existing')
        with self.assertRaisesRegex(ValueError, '同名'):
            self.write(action='finish', ticket=ticket)
        self.assertEqual(target.read_bytes(), b'existing')
        self.assertEqual(list(self.folder.iterdir()), [target])

    def test_configured_boundary_applies_to_destination(self):
        outside = self.root / 'outside'
        outside.mkdir()
        params = self.params(parent=str(outside), name='escape.txt')
        params['_workspace_directory'] = DirectoryAnchor(self.folder)
        with patch.dict('os.environ', {'FILE_WORKSPACE_ALLOWED_ROOT': str(self.folder)}):
            with self.assertRaisesRegex(ValueError, '范围'):
                create_file(params)
        self.assertEqual(list(outside.iterdir()), [])
