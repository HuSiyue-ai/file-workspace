import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import file_writer
from file_reader import read_file


class MarkdownSaveTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=Path(__file__).parent);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.path=self.root/'中文 空格.md';self.path.write_bytes(b'\xef\xbb\xbf# old\r\nline\r\n')
        self.backups=self.root/'backups';self.mock=patch.object(file_writer,'BACKUP_ROOT',self.backups);self.mock.start();self.addCleanup(self.mock.stop)
    def params(self,text='# 新标题\n\n公式 $E=mc^2$。\n',revision=None,path=None):
        return {'arguments':{'path':str(path or self.path),'text':text,'revision':revision or hashlib.sha256(self.path.read_bytes()).hexdigest()},'_meta':{'openai/resource':{'path':'/'+self.path.as_posix()}}}
    def test_revision_backup_bom_crlf_repeat_save(self):
        original=self.path.read_bytes();read=read_file(self.params())['structuredContent'];self.assertEqual(read['revision'],hashlib.sha256(original).hexdigest())
        result=file_writer.save_markdown(self.params())['structuredContent'];self.assertTrue(result['saved'])
        self.assertEqual(self.path.read_bytes(),b'\xef\xbb\xbf'+'# 新标题\r\n\r\n公式 $E=mc^2$。\r\n'.encode())
        self.assertEqual(Path(result['backupPath']).read_bytes(),original)
        result2=file_writer.save_markdown(self.params())['structuredContent'];self.assertNotIn('backupPath',result2)
        self.assertEqual(len(list(self.backups.glob('*.md.bak'))),1)
    def test_external_modification_rejected(self):
        params=self.params();self.path.write_text('# external',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'其他程序修改'):file_writer.save_markdown(params)
        self.assertEqual(self.path.read_text(encoding='utf-8'),'# external');self.assertFalse(self.backups.exists())
    def test_invalid_scope_format_encoding_limit(self):
        other=self.root/'text.txt';other.write_text('hello',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'仅支持'):file_writer.save_markdown(self.params(path=other))
        with self.assertRaises(ValueError):file_writer.save_markdown({'arguments':self.params()['arguments']})
        with self.assertRaises(ValueError):file_writer.save_markdown(self.params(text='bad\0'))
        with patch.object(file_writer,'MAX_TEXT_BYTES',2):
            with self.assertRaises(ValueError):file_writer.save_markdown(self.params())
        with self.assertRaises(FileNotFoundError):file_writer.save_markdown(self.params(path=self.root/'missing.md'))
    def test_backup_failure_and_replace_failure_preserve_original(self):
        original=self.path.read_bytes()
        with patch.object(Path,'mkdir',side_effect=PermissionError('backup denied')):
            with self.assertRaises(PermissionError):file_writer.save_markdown(self.params())
        self.assertEqual(self.path.read_bytes(),original)
        with patch.object(file_writer.os,'replace',side_effect=PermissionError('replace denied')):
            with self.assertRaises(PermissionError):file_writer.save_markdown(self.params())
        self.assertEqual(self.path.read_bytes(),original);self.assertFalse(list(self.root.glob('.*.tmp')))

if __name__=='__main__':unittest.main()
