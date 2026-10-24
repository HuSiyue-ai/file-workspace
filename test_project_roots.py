import json
import unittest
from pathlib import Path
from unittest.mock import patch
from project_context import current_project, project_roots
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


if __name__=='__main__':unittest.main()
