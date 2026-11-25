from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock

from workspace_launcher import WorkspaceLauncher
from workspace_pins import WorkspacePins


class WorkspacePinsTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.folder = self.root / '常用'
        self.folder.mkdir()
        self.launcher = WorkspaceLauncher()
        self.ssh = Mock()
        self.ssh.tokens = {}
        self.pins = WorkspacePins(self.launcher, self.ssh, self.root)

    def call(self, action, **args):
        return self.pins.run({'arguments': {'action': action, **args}})['structuredContent']

    def test_local_pin_persists_without_original_session(self):
        self.assertEqual(self.call('list')['pins'], [])
        self.assertFalse(self.pins.database.exists())
        with self.assertRaises((ValueError, OSError)):
            self.call('pin', path=str(self.folder))
        token = self.launcher.grant(self.root, 'directory')['structuredContent']['session']
        pin = self.call('pin', path=str(self.folder), workspaceSession=token)['pins'][0]
        self.assertEqual(self.call('pin', path=str(self.folder), workspaceSession=token)['pins'], [pin])
        self.launcher = WorkspaceLauncher()
        self.pins = WorkspacePins(self.launcher, self.ssh, self.root)
        opened = self.call('open', id=pin['id'])
        self.assertEqual(Path(opened['directory']['path']), self.folder.resolve())
        self.assertNotEqual(opened['session'], token)
        self.folder.rmdir()
        with self.assertRaises(OSError):
            self.call('open', id=pin['id'])
        self.assertEqual(self.call('unpin', id=pin['id'])['pins'], [])

    def test_ssh_pin_renews_only_the_same_configured_profile(self):
        profile = {'id': 'lab', 'host': 'lab-host', 'root': '/shared'}
        self.ssh.tokens = {'ssh-token': profile}
        self.ssh.route.return_value = {'structuredContent': {'directory': '/shared/team'}}
        with self.assertRaises(ValueError):
            self.call('pin', path='/shared-other/team', workspaceSession='ssh-token')
        self.ssh.route.assert_not_called()
        pins = self.call('pin', path='/shared/team', workspaceSession='ssh-token')['pins']
        self.assertEqual(pins[0]['host'], profile['host'])
        self.ssh.tokens = {'new-ssh-token': profile}
        self.assertEqual(self.call('open', id=pins[0]['id'])['session'], 'new-ssh-token')
        self.ssh.tokens = {'new-ssh-token': {**profile, 'root': '/other'}}
        with self.assertRaises(ValueError):
            self.call('open', id=pins[0]['id'])


if __name__ == '__main__':
    unittest.main()
