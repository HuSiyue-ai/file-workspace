import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch
from project_context import current_project, project_roots, selected_project_roots
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

    def test_new_draft_uses_selected_project_without_thread_row_or_assignment(self):
        first=self.root/'主目录';first.mkdir()
        state=self.write_state([str(self.project)],**{'selected-project':{'type':'local','projectId':'draft-project'}})
        data=json.loads(state.read_text(encoding='utf-8'))
        data['local-projects']['draft-project']={'rootPaths':[str(first),str(self.project),str(first)]}
        state.write_text(json.dumps(data),encoding='utf-8');before=state.read_bytes()
        params={'_meta':{'threadId':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},'arguments':{'allowSelectedProject':True}}
        self.assertEqual(project_roots(params,self.root),[])
        self.assertEqual(selected_project_roots(params,self.root),[first.resolve(),self.project.resolve()])
        self.assertEqual(state.read_bytes(),before,'startup lookup must never change the desktop project state')
        launcher=WorkspaceLauncher()
        with patch('workspace_launcher.project_roots',side_effect=lambda p:project_roots(p,self.root)),patch('workspace_launcher.selected_project_roots',side_effect=lambda p:selected_project_roots(p,self.root)):
            result=launcher.start(params)['structuredContent']
            self.assertEqual([item['directory']['path'] for item in result['roots']],[str(first.resolve()),str(self.project.resolve())])
            scoped=launcher.authorize({'arguments':{'workspaceSession':result['session']}})
            self.assertEqual(list_directory(scoped)['structuredContent']['directory'],str(first.resolve()))

    def test_selected_project_lookup_honors_codex_home(self):
        self.write_state([])
        with patch.dict(os.environ, {'CODEX_HOME':str(self.root)}):
            self.assertEqual(selected_project_roots({}),[self.root.resolve()])

    def test_fallback_requires_explicit_startup_opt_in_and_keeps_real_project_first(self):
        launcher=WorkspaceLauncher()
        with patch('workspace_launcher.project_roots',return_value=[]),patch('workspace_launcher.selected_project_roots',return_value=[self.project.resolve()]) as fallback:
            self.assertTrue(launcher.start({'arguments':{}})['structuredContent']['needsDirectory'])
            self.assertTrue(launcher.start({'arguments':{'allowSelectedProject':'true'}})['structuredContent']['needsDirectory'])
            fallback.assert_not_called()
        with patch('workspace_launcher.project_roots',return_value=[self.project.resolve()]),patch('workspace_launcher.selected_project_roots') as fallback:
            result=launcher.start({'arguments':{'allowSelectedProject':True}})['structuredContent']
            self.assertEqual(result['directory']['path'],str(self.project.resolve()));fallback.assert_not_called()

    def test_fallback_never_replaces_known_membership_or_remote_selection(self):
        state=self.write_state([str(self.project)])
        original=json.loads(state.read_text(encoding='utf-8'))
        draft='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        cases=[({'thread-project-assignments':{draft:{'projectKind':'local','projectId':'missing'}}},draft),
               ({'thread-project-membership-host-ids':{draft:'ssh:server'}},draft),
               ({'projectless-thread-ids':[draft]},draft),
               ({'selected-project':{'type':'remote','projectId':'other-project'}},draft),
               ({},'invalid-thread')]
        for updates,thread in cases:
            state.write_text(json.dumps({**original,**updates}),encoding='utf-8')
            self.assertEqual(selected_project_roots({'_meta':{'threadId':thread}},self.root),[])

    def test_fallback_filters_invalid_paths_and_malformed_state(self):
        state=self.write_state([])
        data=json.loads(state.read_text(encoding='utf-8'))
        data['local-projects']['other-project']['rootPaths']=['relative',str(self.root/'missing'),str(self.project),str(self.project)]
        state.write_text(json.dumps(data),encoding='utf-8')
        self.assertEqual(selected_project_roots({},self.root),[self.project.resolve()])
        for broken in ('[]','not json','{"selected-project": {"type":"local","projectId":"test"},"local-projects": []}'):
            state.write_text(broken,encoding='utf-8')
            self.assertEqual(selected_project_roots({},self.root),[])


if __name__=='__main__':unittest.main()
