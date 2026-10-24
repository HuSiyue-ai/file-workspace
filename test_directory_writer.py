from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from directory_writer import create_directory,folder_name
from file_reader import DirectoryAnchor
import server


class CreateFolderTests(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory(dir=Path(__file__).parent);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.doc=self.root/'document.md';self.doc.write_text('# untouched',encoding='utf-8')
    def call(self,name='中文 新目录',parent=None,**extra):
        return create_directory({'arguments':{'name':name,'parent':str(parent or self.root)},
            '_meta':{'openai/resource':{'path':str(self.doc)}},**extra})['structuredContent']
    def test_create_single_child_and_no_document_changes(self):
        before=self.doc.read_bytes();data=self.call()
        self.assertTrue(data['created']);self.assertEqual(Path(data['path']),self.root/'中文 新目录')
        self.assertEqual(list(Path(data['path']).iterdir()),[]);self.assertEqual(self.doc.read_bytes(),before)
        sub=self.call('子目录',Path(data['path']));self.assertTrue(Path(sub['path']).is_dir())
    def test_names_and_traversal_rejected_without_writes(self):
        before=set(self.root.iterdir())
        for name in ('',' ',' a','a ','a.','.','..','../escape','a/b','a\\b','C:escape','a\0b','x?','con','NUL.txt','COM1','lpt².ext','CONOUT$','x'*121):
            with self.subTest(name=name),self.assertRaises(ValueError):self.call(name)
        self.assertEqual(set(self.root.iterdir()),before)
        self.assertEqual(folder_name('普通.name'), '普通.name')
    def test_existing_entries_never_replaced(self):
        existing=self.root/'same';existing.mkdir();(existing/'keep.txt').write_text('keep',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'同名'):self.call('same')
        with self.assertRaisesRegex(ValueError,'同名'):self.call('document.md')
        self.assertEqual((existing/'keep.txt').read_text(encoding='utf-8'),'keep')
        self.assertEqual(self.doc.read_text(encoding='utf-8'),'# untouched')
    def test_scope_invalid_parent_and_errors(self):
        args={'arguments':{'parent':str(self.root),'name':'test'}}
        with self.assertRaises(ValueError):create_directory(args)
        for parent in (self.root/'missing',self.doc):
            with self.assertRaises(ValueError):self.call(parent=parent)
        for parent in ('relative','file://remote/share','Z:/outside'):
            with self.assertRaises((ValueError,FileNotFoundError)):create_directory({**args,'_meta':{'openai/resource':{'path':str(self.doc)}},'arguments':{'parent':parent,'name':'test'}})
        with patch('directory_writer.Path.mkdir',side_effect=PermissionError):
            with self.assertRaisesRegex(ValueError,'权限'):self.call()
        self.assertFalse((self.root/'中文 新目录').exists())
    def test_directory_session_and_expired_capability(self):
        grant=server.launcher.grant(self.root,'directory')['structuredContent']
        result=server.dispatch('tools/call',{'name':'create_workspace_directory','arguments':{'parent':str(self.root),'name':'session-folder','workspaceSession':grant['session']}})
        self.assertTrue(result['structuredContent']['created'])
        with self.assertRaisesRegex(ValueError,'会话已失效'):
            server.dispatch('tools/call',{'name':'create_workspace_directory','arguments':{'parent':str(self.root),'name':'never','workspaceSession':'expired'}})
        self.assertFalse((self.root/'never').exists())
        tool=next(t for t in server.dispatch('tools/list',{})['tools'] if t['name']=='create_workspace_directory')
        self.assertFalse(tool['annotations']['readOnlyHint']);self.assertEqual(tool['_meta']['ui']['visibility'],['app'])
    def test_symlink_or_reparse_parent_rejected(self):
        with patch('directory_writer.Path.is_symlink',return_value=True):
            with self.assertRaisesRegex(ValueError,'链接'):self.call()
        self.assertFalse((self.root/'中文 新目录').exists())


if __name__=='__main__':unittest.main()
