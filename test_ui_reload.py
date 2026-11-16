import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from ui_reload import UIUpdates, runtime_fingerprint


class ReloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'server.py').write_text('# original backend\n',encoding='utf-8')
        self.publish('old UI','1.0')
        self.updates = UIUpdates(self.root,'1.0')

    def publish(self, html, version):
        (self.root/'viewer.html').write_text(html,encoding='utf-8')
        metadata={'version':version,'runtimeHash':runtime_fingerprint(self.root),
                  'uiHash':hashlib.sha256((self.root/'viewer.html').read_bytes()).hexdigest()}
        (self.root/'ui-build.json').write_text(json.dumps(metadata),encoding='utf-8')

    def test_reads_new_ui_without_restarting_backend(self):
        self.publish('new UI 中文','1.1')
        result=self.updates.read()['structuredContent']
        self.assertEqual(result['html'],'new UI 中文')
        self.assertEqual((result['uiVersion'],result['backendVersion']),('1.1','1.0'))
        self.assertFalse(result['restartRequired'])

    def test_crlf_bundle_hash_uses_actual_disk_bytes(self):
        self.publish('line one\n中文\n','1.1')
        self.assertEqual(self.updates.read()['structuredContent']['html'].splitlines(),['line one','中文'])

    def test_changed_runtime_reports_restart_without_sending_incompatible_ui(self):
        (self.root/'server.py').write_text('# new API\n',encoding='utf-8')
        self.publish('new incompatible UI','2.0')
        result=self.updates.read()['structuredContent']
        self.assertTrue(result['restartRequired'])
        self.assertNotIn('html',result)

    def test_runtime_config_changes_require_restart(self):
        (self.root/'ssh-workspaces.json').write_text('[]',encoding='utf-8')
        self.publish('UI','1.1')
        self.assertTrue(self.updates.read()['structuredContent']['restartRequired'])

    def test_partial_update_is_rejected(self):
        (self.root/'server.py').write_text('# partial update\n',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'尚未完成'):self.updates.read()

    def test_bad_ui_hash_is_rejected(self):
        (self.root/'viewer.html').write_text('damaged',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'校验失败'):self.updates.read()


if __name__=='__main__':unittest.main()
