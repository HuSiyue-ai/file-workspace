import base64
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from image_demo import prepare_demo
from image_reader import read_images, local_path, image_references

class ImageReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.root=Path(self.temp.name);self.document=prepare_demo(self.root)
        self.png=self.root/'图片样例/中文 空格.png';self.before=self.document.read_bytes()
    def tearDown(self):
        self.assertEqual(self.document.read_bytes(),self.before);self.temp.cleanup()
    def call(self,sources,path=None):
        params={'arguments':{'sources':sources},'_meta':{'openai/resource':{'path':str(path or self.document)}}}
        return read_images(params)['structuredContent']['images']
    def test_supported_syntax_and_path_forms(self):
        sources=['图片样例/中文 空格.png','图片样例/中文%20空格.png',self.png.as_uri(),self.png.as_posix(),'图片样例/示意图.svg']
        for source,result in zip(sources,self.call(sources)):
            with self.subTest(source=source):
                self.assertIn('blob',result);self.assertEqual(base64.b64decode(result['blob']),local_path(source,self.document).read_bytes())
    def test_parent_relative_and_parentheses(self):
        note_folder=self.root/'notes';note_folder.mkdir();note=note_folder/'note.md'
        parent_image=self.root/'图片样例/name(1).png';parent_image.write_bytes(self.png.read_bytes())
        note.write_text('![图](../图片样例/name(1).png)',encoding='utf-8')
        self.assertIn('blob',self.call(['../图片样例/name(1).png'],note)[0])
    def test_filename_extension_does_not_override_actual_encoding(self):
        renamed=self.root/'png-with-jpeg-extension.jpg'
        renamed.write_bytes(self.png.read_bytes())
        self.document.write_text(self.before.decode()+'\n![renamed PNG](png-with-jpeg-extension.jpg)\n',encoding='utf-8')
        try:
            result=self.call(['png-with-jpeg-extension.jpg'])[0]
            self.assertEqual(result.get('mimeType'),'image/png')
            self.assertEqual(base64.b64decode(result['blob']),self.png.read_bytes())
        finally:self.document.write_bytes(self.before)
    def test_missing_image_does_not_hide_other_images(self):
        results=self.call(['图片样例/不存在.png','图片样例/中文 空格.png'])
        self.assertIn('error',results[0]);self.assertIn('blob',results[1])
    def test_host_windows_path_formats(self):
        # The real file tab uses /C:/... rather than Python's C:/... Windows path.
        for path in [str(self.document),'/'+self.document.as_posix(),self.document.as_uri()]:
            with self.subTest(path=path):
                self.assertIn('blob',self.call(['图片样例/中文 空格.png'],path)[0])
    def test_slash_prefixed_windows_image_path(self):
        source='/'+self.png.as_posix()
        self.assertIn('blob',self.call([source])[0])
    def test_reject_unreferenced_and_non_image(self):
        extra=self.root/'extra.png';extra.write_bytes(self.png.read_bytes());self.assertIn('error',self.call(['extra.png'])[0])
        fake=self.root/'not-an-image.png';fake.write_text('private text',encoding='utf-8')
        self.document.write_text(self.before.decode()+'\n![fake](not-an-image.png)',encoding='utf-8')
        try:self.assertIn('error',self.call(['not-an-image.png'])[0])
        finally:self.document.write_bytes(self.before)
    def test_requires_host_document_and_rejects_network(self):
        with self.assertRaises(ValueError):read_images({'arguments':{'sources':['图片样例/中文 空格.png']}})
        for source in ['https://example.com/image.png','file://remote-server/share/image.png','\\\\remote-server\\share\\image.png','//remote-server/share/image.png']:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):local_path(source,self.document)
    def test_deduplicate_and_size_limit(self):
        self.assertEqual(len(self.call(['图片样例/中文 空格.png']*3)),1)
        with patch('image_reader.MAX_IMAGE_BYTES',1):self.assertIn('error',self.call(['图片样例/中文 空格.png'])[0])
    def test_code_examples_are_not_embedded_images(self):
        example=self.root/'only-code.png';example.write_bytes(self.png.read_bytes())
        self.document.write_text(self.before.decode()+'\n```markdown\n![example](only-code.png)\n```\n',encoding='utf-8')
        try:
            self.assertNotIn('only-code.png',image_references(self.document.read_bytes().decode('utf-8-sig')))
            self.assertIn('error',self.call(['only-code.png'])[0])
        finally:self.document.write_bytes(self.before)

if __name__=='__main__':unittest.main()
