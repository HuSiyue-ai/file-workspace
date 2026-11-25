"""Exercise real worker replacement over the same MCP stdio connection."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from ui_reload import runtime_fingerprint

PLUGIN = Path(__file__).resolve().parents[1] / 'plugins' / 'markdown-math-preview'


class BackendReloadTests(unittest.TestCase):
    def test_same_connection_preserves_sessions_and_rolls_back_failed_candidate(self):
        with tempfile.TemporaryDirectory() as temp:
            scratch = Path(temp)
            bundle = scratch / 'plugin'
            shutil.copytree(PLUGIN, bundle)
            project = scratch / 'project'
            project.mkdir()
            document = project / 'example.md'
            document.write_text('# 原文件', encoding='utf-8')
            server = bundle / 'server.py'
            original_server = server.read_text(encoding='utf-8')
            original_html = (bundle / 'viewer.html').read_bytes()
            ssh_config = bundle / 'ssh-workspaces.json'
            ssh_config.write_text(json.dumps([{'id': 'test', 'label': 'SSH fixture', 'host': 'ssh-test',
               'root': '/tmp/demo', 'python': '/usr/bin/python3', 'server': '/tmp/demo/server.py'}]), encoding='utf-8')
            active_version = (bundle / 'VERSION').read_text(encoding='utf-8').strip()

            def publish(version, source):
                server.write_text(source, encoding='utf-8')
                html = original_html + ('<!-- '+version+' -->').encode()
                (bundle / 'VERSION').write_text(version, encoding='utf-8')
                (bundle / 'viewer.html').write_bytes(html)
                (bundle / 'ui-build.json').write_text(json.dumps({
                    'version': version, 'uiHash': hashlib.sha256(html).hexdigest(),
                    'runtimeHash': runtime_fingerprint(bundle),
                }), encoding='utf-8')

            publish(active_version, original_server)
            env = {**os.environ, 'FILE_WORKSPACE_PROJECT_ROOT': str(project),
                   'FILE_WORKSPACE_ALLOWED_ROOT': str(project), 'FILE_WORKSPACE_HEADLESS': '1'}
            with subprocess.Popen([sys.executable, '-B', str(bundle / 'backend_host.py')],
                                  env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE) as host:
                counter = 0

                def rpc(method, params=None):
                    nonlocal counter
                    counter += 1
                    request = {'id': counter, 'jsonrpc': '2.0', 'method': method, 'params': params or {}}
                    host.stdin.write((json.dumps(request, ensure_ascii=False) + '\n').encode('utf-8'))
                    host.stdin.flush()
                    line = host.stdout.readline()
                    self.assertTrue(line, 'the host connection closed')
                    reply = json.loads(line)
                    self.assertEqual(reply['id'], counter)
                    return reply

                def tool(tool_name, **arguments):
                    return rpc('tools/call', {'name': tool_name, 'arguments': arguments})

                def content(tool_name, **arguments):
                    result = tool(tool_name, **arguments)
                    self.assertIn('result', result, result)
                    return result['result']['structuredContent']

                def preview(token):
                    return content('read_preview_file', path=str(document), workspaceSession=token)['text']

                try:
                    self.assertEqual(rpc('initialize')['result']['serverInfo']['version'],active_version)
                    start = content('get_workspace_start')
                    token = start['session']
                    ssh_token = start['roots'][1]['session']
                    self.assertEqual(preview(token), '# 原文件')
                    self.assertIn('error',rpc('file-workspace/worker/snapshot'))
                    changed = original_server.replace("if params.get('name') == FILE_TOOL['name']: return preview_file(params)",
                        """if params.get('name') == FILE_TOOL['name']:
            result = read_file(params)
            result['structuredContent']['text'] += ' · 新后台'
            return result""")
                    self.assertNotEqual(original_server,changed)
                    publish('1.14.1', changed)
                    self.assertTrue(content('read_workspace_update')['backendUpdateAvailable'])
                    self.assertEqual(preview(token), '# 原文件')
                    transfer = content('write_workspace_copy',action='begin',parent=str(project),
                                       name='transfer.txt',size=0,workspaceSession=token)['ticket']
                    refused = tool('read_workspace_update',apply=True)
                    self.assertIn('传输', refused['error']['message'])
                    content('write_workspace_copy',action='abort',ticket=transfer,workspaceSession=token)
                    updated = content('read_workspace_update', apply=True)
                    self.assertTrue(updated['backendReloaded'])
                    self.assertEqual(updated['backendVersion'], '1.14.1')
                    self.assertIn('<!-- 1.14.1 -->',updated['html'])
                    self.assertEqual(preview(token), '# 原文件 · 新后台')
                    self.assertEqual(content('get_workspace_start')['roots'][1]['session'], ssh_token)
                    self.assertEqual(content('list_markdown_directory',workspaceSession=token)['entries'][0]['name'],'example.md')
                    resource = rpc('resources/read',{'uri':'ui://markdown-math-preview/viewer.html'})
                    self.assertIn('<!-- 1.14.1 -->',resource['result']['contents'][0]['text'])

                    publish('1.14.2', 'raise RuntimeError("candidate boot failed")\n')
                    self.assertIn('error',tool('read_workspace_update', apply=True))
                    self.assertEqual(preview(token), '# 原文件 · 新后台')
                    catalog_change = changed.replace("'title': '重载已安装的插件'", "'title': 'Changed tool catalog'")
                    self.assertNotEqual(changed,catalog_change)
                    publish('1.14.2',catalog_change)
                    self.assertIn('工具或资源注册',tool('read_workspace_update',apply=True)['error']['message'])
                    self.assertEqual(preview(token), '# 原文件 · 新后台')
                    (bundle / '.mcp.json').write_text('{}',encoding='utf-8')
                    publish('1.14.2',changed)
                    self.assertTrue(content('read_workspace_update')['restartRequired'])
                    self.assertEqual(preview(token), '# 原文件 · 新后台')
                finally:
                    host.stdin.close()
                    host.wait(timeout=15)
