from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from directory_reader import list_directory

class DirectoryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=Path(__file__).parent);self.root=Path(self.temp.name)
        self.document=self.root/'中文文档.md';self.document.write_text('# 文档\n',encoding='utf-8')
        self.folder=self.root/'子目录';self.folder.mkdir();(self.folder/'子文档.md').write_text('child',encoding='utf-8')
        (self.root/'other.md').write_text('other',encoding='utf-8');self.before=self.document.read_bytes()
    def tearDown(self):
        self.assertEqual(self.before,self.document.read_bytes());self.temp.cleanup()
    def call(self,arguments=None,path=None):
        return list_directory({'arguments':arguments or {},'_meta':{'openai/resource':{'path':path or ('/' if self.document.drive else '')+self.document.as_posix()}}})['structuredContent']
    def test_current_folder_lazy_listing_and_sort(self):
        data=self.call();self.assertEqual(Path(data['directory']),self.root)
        self.assertEqual(data['entries'][0]['kind'],'directory')
        self.assertNotIn('子文档.md',[entry['name'] for entry in data['entries']])
        for entry in data['entries']:self.assertEqual(set(entry),{'name','path','kind'})
    def test_enter_folder_and_return_parent(self):
        data=self.call({'directory':str(self.folder)})
        self.assertEqual([entry['name'] for entry in data['entries']],['子文档.md'])
        self.assertEqual(Path(data['parent']),self.root)
        self.assertEqual(Path(data['documentPath']),self.document)
    def test_file_uri_document_and_directory(self):
        data=self.call({'directory':self.folder.as_uri()},self.document.as_uri())
        self.assertEqual(Path(data['directory']),self.folder)
    def test_bounded_listing(self):
        with patch('directory_reader.MAX_ENTRIES',1):
            data=self.call();self.assertEqual(len(data['entries']),1);self.assertTrue(data['truncated'])
    def test_invalid_requests(self):
        with self.assertRaises(ValueError):list_directory({'arguments':{}})
        with self.assertRaises(ValueError):self.call({'directory':self.document.as_uri()})
        with self.assertRaises(ValueError):self.call({'directory':'file://remote-server/share'})

if __name__=='__main__':unittest.main()
