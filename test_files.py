import base64
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from file_reader import read_file, selected_file
from image_reader import read_images
from directory_reader import list_directory


class UnifiedFileTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=Path(__file__).parent);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.anchor=self.root/'入口.md';self.anchor.write_text('# 入口',encoding='utf-8')
        self.second=self.root/'第二篇.md';self.second.write_text('# 第二篇\n![图](图片.png)',encoding='utf-8')
        self.picture=self.root/'图片.png';self.picture.write_bytes(b'\xff\xd8\xff\xe0jpeg-fixture')
        self.text=self.root/'说明.txt';self.text.write_text('说明\nline 2',encoding='utf-8')
    def params(self,args=None,anchor=None):
        return {'arguments':args or {},'_meta':{'openai/resource':{'path':('/' if (anchor or self.anchor).drive else '')+(anchor or self.anchor).as_posix()}}}
    def test_switch_markdown_picture_text(self):
        for path,kind in [(self.anchor,'markdown'),(self.picture,'image'),(self.second,'markdown'),(self.text,'text')]:
            data=read_file(self.params({'path':str(path)}))['structuredContent'];self.assertEqual(data['kind'],kind)
            self.assertEqual(Path(data['path']),path)
            if kind=='image':
                self.assertEqual(data['mimeType'],'image/jpeg');self.assertEqual(base64.b64decode(data['blob']),path.read_bytes())
            else:self.assertEqual(data['text'],path.read_bytes().decode('utf-8-sig'))
    def test_picture_entry_has_same_tree(self):
        data=read_file(self.params(anchor=self.picture))['structuredContent'];self.assertEqual(data['kind'],'image')
        tree=list_directory(self.params(anchor=self.picture))['structuredContent'];self.assertEqual(Path(tree['directory']),self.root)
        data=read_file(self.params({'path':str(self.second)},anchor=self.picture))['structuredContent'];self.assertEqual(data['kind'],'markdown')
    def test_internal_md_images_use_its_own_references(self):
        args={'documentPath':str(self.second),'sources':['图片.png']}
        result=read_images(self.params(args))['structuredContent']['images'][0];self.assertIn('blob',result)
        result=read_images(self.params({'sources':['图片.png']}))['structuredContent']['images'][0];self.assertIn('error',result)
    def test_boundaries_and_limits(self):
        with self.assertRaises(ValueError):read_file({'arguments':{'path':str(self.anchor)}})
        with self.assertRaises(ValueError):selected_file(self.params(),'file://remote/share/a.md')
        if self.anchor.drive:
            # 只替换虚构目标的解析，既不依赖第二块磁盘，也不接触真实用户文档。
            other=Path('Z:/file-workspace-test/outside.md')
            if self.anchor.drive.upper()!='Z:':
                resolve=Path.resolve
                def resolve_fixture(path,*args,**kwargs):
                    return path if path==other else resolve(path,*args,**kwargs)
                with patch.object(Path,'resolve',resolve_fixture):
                    with self.assertRaisesRegex(ValueError,'磁盘'):selected_file(self.params(),str(other))
        unknown=self.root/'a.pdf';unknown.write_bytes(b'%PDF')
        with self.assertRaises(ValueError):read_file(self.params({'path':str(unknown)}))
        with patch('file_reader.MAX_TEXT_BYTES',2):
            with self.assertRaises(ValueError):read_file(self.params())
        with patch('file_reader.MAX_PICTURE_BYTES',2):
            with self.assertRaises(ValueError):read_file(self.params({'path':str(self.picture)}))


if __name__=='__main__':unittest.main()
