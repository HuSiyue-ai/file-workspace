import json
import os
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from project_context import current_project, project_roots, desktop_project_choices
import test_project_start as fixtures
THREAD=fixtures.THREAD
from workspace_launcher import WorkspaceLauncher
from directory_reader import list_directory


class ProjectRootsTests(unittest.TestCase):
    setUp=fixtures.ProjectStartTests.setUp
    def write_state(self, roots, **extra):
        state={'thread-project-assignments':{THREAD:{'projectKind':'local','projectId':'this-project'}},
               'thread-project-membership-host-ids':{THREAD:'local'},
               'local-projects':{'this-project':{'rootPaths':roots},'other-project':{'rootPaths':[str(self.root)]}},
               'selected-project':{'type':'local','projectId':'other-project'},**extra}
        path=self.root/'.codex-global-state.json';path.write_text(json.dumps(state),encoding='utf-8');return path

    def test_ordered_project_roots_override_runtime_cwd_and_global_selected(self):
        main=self.root/'.codex';main.mkdir()
        state=self.write_state([str(main),str(self.project)])
        before=state.read_bytes()
        self.assertEqual(project_roots({'_meta':{'threadId':THREAD}},self.root),[main.resolve(),self.project.resolve()])
        self.assertEqual(current_project({'_meta':{'threadId':THREAD}},self.root),main.resolve())
        self.assertEqual(state.read_bytes(),before)

    def test_deduplicate_filter_missing_roots_preserve_order(self):
        self.write_state([str(self.root/'missing'),str(self.project),str(self.project),str(self.root)])
        self.assertEqual(project_roots({'_meta':{'threadId':THREAD}},self.root),[self.project.resolve(),self.root.resolve()])

    def test_other_thread_assignment_cannot_set_current_defaults(self):
        self.write_state([str(self.root)],**{'thread-project-assignments':{'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa':{'projectKind':'local','projectId':'this-project'}}})
        self.assertEqual(current_project({'_meta':{'threadId':THREAD}},self.root),self.project.resolve())

    def test_unreadable_malformed_mapping_falls_back_to_own_cwd(self):
        path=self.root/'.codex-global-state.json'
        for content in ('not json','[]','{"local-projects": []}'):
            path.write_text(content,encoding='utf-8')
            self.assertEqual(project_roots({'_meta':{'threadId':THREAD}},self.root),[self.project.resolve()])

    def test_start_returns_independent_capabilities_for_each_root(self):
        main=self.root/'.codex';main.mkdir();roots=[main.resolve(),self.project.resolve()]
        launcher=WorkspaceLauncher()
        with patch('workspace_launcher.project_roots',return_value=roots):
            data=launcher.start({'_meta':{'threadId':THREAD}})['structuredContent']
        self.assertEqual(data['directory']['path'],str(main.resolve()))
        self.assertEqual([item['directory']['path'] for item in data['roots']],[str(path) for path in roots])
        self.assertEqual(len({item['session'] for item in data['roots']}),2)
        for item in data['roots']:
            params=launcher.authorize({'arguments':{'workspaceSession':item['session']}})
            self.assertEqual(list_directory(params)['structuredContent']['directory'],item['directory']['path'])

    def add_native_project(self, name, path):
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT,position INT)')
            db.execute('CREATE TABLE IF NOT EXISTS project_roots(project_id TEXT,position INT,path TEXT)')
            db.execute('INSERT INTO projects VALUES (?,?,0)', (name,name))
            db.execute('INSERT INTO project_roots VALUES (?,0,?)', (name,str(path)))

    def test_two_drafts_get_choices_but_never_the_stale_robotics_default(self):
        course=self.root/'course';course.mkdir()
        robotics=self.root/'robotics';robotics.mkdir()
        state=self.write_state([str(self.project)])
        data=json.loads(state.read_text(encoding='utf-8'))
        data['local-projects']['robotics']={'name':'Robotics','rootPaths':[str(robotics)]}
        data['electron-owner-value:selected-project:'+'a'*64]={'type':'local','projectId':'robotics'}
        state.write_text(json.dumps(data),encoding='utf-8')
        self.add_native_project('Robotics',robotics)
        self.add_native_project('Course',course)
        before=state.read_bytes()
        launcher=WorkspaceLauncher()
        with patch.dict(os.environ, {'CODEX_HOME':str(self.root)}):
            for meta in ({}, {'threadId':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}):
                result=launcher.start({'_meta':meta,'arguments':{'allowSelectedProject':True}})['structuredContent']
                self.assertTrue(result['needsDirectory'])
                self.assertNotIn('directory',result)
                choices={item['directory']['name']:item for item in result['roots']}
                for label,expected in [('Course',course),('Robotics',robotics)]:
                    scope=launcher.authorize({'arguments':{'workspaceSession':choices[label]['session']}})
                    self.assertEqual(Path(list_directory(scope)['structuredContent']['directory']),expected.resolve())
            self.assertEqual(len(launcher.sessions),2)
            self.assertEqual(launcher.start({'arguments':{}})['structuredContent']['roots'],[])
        self.assertEqual(state.read_bytes(),before)

    def test_native_thread_assignment_precedes_stale_legacy_and_cwd(self):
        first=self.root/'native';first.mkdir()
        second=self.root/'nested';second.mkdir()
        self.write_state([str(self.root)])
        self.add_native_project('Native',first)
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('ALTER TABLE threads ADD COLUMN project_id TEXT')
            db.execute('UPDATE threads SET project_id=? WHERE id=?',('Native',THREAD))
            db.execute('INSERT INTO project_roots VALUES (?,1,?)',('Native',str(second)))
        with patch.dict(os.environ, {'CODEX_HOME':str(self.root)}):
            result=WorkspaceLauncher().start({'_meta':{'threadId':THREAD},'arguments':{'allowSelectedProject':True}})['structuredContent']
        self.assertEqual([Path(item['directory']['path']) for item in result['roots']],[first.resolve(),second.resolve()])

    def test_legacy_catalog_filters_invalid_and_duplicate_folders(self):
        self.write_state([str(self.root/'missing'),str(self.project),str(self.project)])
        with patch.dict(os.environ, {'CODEX_HOME':str(self.root)}):
            self.assertEqual([path for path,label in desktop_project_choices()],[self.project.resolve(),self.root.resolve()])


if __name__=='__main__':unittest.main()
