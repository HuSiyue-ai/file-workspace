import hashlib
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from project_context import current_project, local_directory
from workspace_launcher import WorkspaceLauncher
from file_reader import read_file
from directory_reader import list_directory
from image_reader import read_images
from test_launcher import FakeProcess
import file_writer
import server

THREAD='11111111-1111-4111-8111-111111111111'
OTHER='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'


class ProjectStartTests(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory(dir=Path(__file__).parent);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.project=self.root/'项目 空格';self.project.mkdir()
        self.database=self.root/'state_5.sqlite'
        conn=sqlite3.connect(self.database)
        conn.execute('CREATE TABLE threads(id TEXT PRIMARY KEY,cwd TEXT)')
        conn.executemany('INSERT INTO threads VALUES(?,?)',[(THREAD,str(self.project)),(OTHER,str(self.root))])
        conn.commit();conn.close()
        self.launcher=WorkspaceLauncher()

    def test_resolve_only_current_conversation_and_read_only_database(self):
        before=hashlib.sha256(self.database.read_bytes()).hexdigest()
        self.assertEqual(current_project({'_meta':{'threadId':THREAD}},self.root),self.project.resolve())
        self.assertEqual(current_project({'_meta':{'thread_id':OTHER}},self.root),self.root.resolve())
        self.assertEqual(before,hashlib.sha256(self.database.read_bytes()).hexdigest())

    def test_missing_invalid_unknown_context_never_guesses(self):
        for meta in ({},{'threadId':'bad'},{'threadId':"' OR 1=1 --"},{'threadId':'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'}):
            self.assertIsNone(current_project({'_meta':meta},self.root))
        with patch('workspace_launcher.project_roots',return_value=[]):
            self.assertEqual(self.launcher.start({})['structuredContent'],{'needsDirectory':True,'roots':[]})

    def test_removed_folder_and_new_schema_fail_safely(self):
        self.project.rmdir()
        self.assertIsNone(current_project({'_meta':{'threadId':THREAD}},self.root))
        newer=self.root/'state_6.sqlite'
        c=sqlite3.connect(newer);c.execute('CREATE TABLE threads(other TEXT)');c.close()
        self.assertEqual(current_project({'_meta':{'threadId':OTHER}},self.root),self.root.resolve())

    def test_local_extended_path_supported_network_and_relative_rejected(self):
        if str(self.project)[1:3]==':\\':
            self.assertEqual(local_directory('\\\\?\\'+str(self.project)),self.project.resolve())
        for value in ('relative','\\\\server\\share','\\\\?\\UNC\\server\\share','\\\\.\\C:'):
            with self.assertRaises((ValueError,OSError)):local_directory(value)

    def test_start_empty_project_tree_before_any_document(self):
        with patch('workspace_launcher.project_roots',return_value=[self.project.resolve()]):
            data=self.launcher.start({'_meta':{'threadId':THREAD}})['structuredContent']
        params=self.launcher.authorize({'arguments':{'workspaceSession':data['session']}})
        directory=list_directory(params)['structuredContent']
        self.assertEqual(directory['directory'],str(self.project.resolve()))
        self.assertEqual(directory['entries'],[])
        self.assertIsNone(directory['documentPath'])
        with self.assertRaises(ValueError):read_file(params)
        with self.assertRaises(ValueError):list_directory({'_workspace_directory':{'path':str(self.project)},'arguments':{}})

    def test_folder_dialog_grants_folder_and_browse_does_not_require_md(self):
        with patch('workspace_launcher.subprocess.Popen',return_value=FakeProcess({'path':str(self.project)})):
            ticket=self.launcher.begin('directory')['structuredContent']['ticket']
        data=self.launcher.poll(ticket)['structuredContent']
        self.assertIn('directory',data)
        self.assertNotIn('file',data)
        with patch.object(server,'launcher',self.launcher):
            result=server.dispatch('tools/call',{'name':'list_markdown_directory','arguments':{'workspaceSession':data['session']}})
        self.assertEqual(result['structuredContent']['entries'],[])

    def test_tree_selection_read_images_text_save_and_external_conflict(self):
        note=self.project/'笔记.md';note.write_text('# 原文\n\n![image](plot.svg)\n',encoding='utf-8')
        (self.project/'plot.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>',encoding='utf-8')
        (self.project/'notes.txt').write_text('plain text',encoding='utf-8')
        data=self.launcher.grant(self.project.resolve(),'directory')['structuredContent']
        with patch.object(server,'launcher',self.launcher):
            def call(name,**args):
                return server.dispatch('tools/call',{'name':name,'arguments':{'workspaceSession':data['session'],**args}})['structuredContent']
            self.assertEqual(len(call('list_markdown_directory')['entries']),3)
            original=call('read_preview_file',path='笔记.md')
            self.assertEqual(original['kind'],'markdown')
            self.assertEqual(call('read_preview_file',path='notes.txt')['text'],'plain text')
            self.assertIn('blob',call('read_markdown_images',documentPath=str(note),sources=['plot.svg'])['images'][0])
            self.assertEqual(call('read_preview_file',path='plot.svg')['kind'],'image')
            with patch.object(file_writer,'BACKUP_ROOT',self.root/'backups'):
                saved=call('save_markdown_file',path=str(note),text='# 已修改',revision=original['revision'])
                self.assertTrue(saved['saved'])
                self.assertTrue(Path(saved['backupPath']).exists())
                with self.assertRaises(ValueError):call('save_markdown_file',path=str(note),text='# 冲突',revision=original['revision'])


if __name__=='__main__':unittest.main()
