import base64
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from csv_reader import csv_preview
from file_reader import read_file
from pdf_reader import read_pdf,pdf_job,pdf_revision,DEFAULT_PYTHON

ROOT=Path(__file__).parent
PDF=ROOT/'examples/preview-sample.pdf'


class CsvTests(unittest.TestCase):
    def test_quotes_crlf_multiline_unicode_literal_formula(self):
        data=csv_preview('name,value,note\r\nA,=1+1,"中文,逗号"\r\nB,2,"line1\r\nline2"\r\n')
        self.assertEqual(data['columns'],3)
        self.assertEqual(data['rows'][1],['A','=1+1','中文,逗号'])
        self.assertEqual(data['rows'][2][2],'line1\r\nline2')

    def test_delimiter_detection_empty_and_irregular_rows(self):
        self.assertEqual(csv_preview('a;b;c\n1;2;3\n')['delimiter'],';')
        self.assertEqual(csv_preview('a\tb\n1\t2\n','\t')['rows'][1],['1','2'])
        self.assertEqual(csv_preview('')['rows'],[])
        self.assertEqual(csv_preview('a,b\nx\ny,z,q\n')['columns'],3)

    def test_malformed_csv_and_limits(self):
        self.assertIn('error',csv_preview('a,b\n"unclosed,thing'))
        with patch('csv_reader.MAX_ROWS',2):self.assertTrue(csv_preview('x\n1\n2\n3\n')['truncated'])
        with patch('csv_reader.MAX_COLUMNS',2):
            data=csv_preview('a,b,c\n1,2,3\n');self.assertTrue(data['columnTruncated']);self.assertEqual(data['columns'],2)
        with patch('csv_reader.MAX_CELLS',2):self.assertTrue(csv_preview('a,b\n1,2\n')['truncated'])

    def test_file_bridge_preserves_raw_text_and_bom(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            p=Path(directory)/'中文 表格.csv';p.write_bytes(b'\xef\xbb\xbf'+b'a,b\r\n1,2\r\n')
            data=read_file({'arguments':{},'_meta':{'openai/resource':{'path':str(p)}}})['structuredContent']
            self.assertEqual(data['text'],'a,b\r\n1,2\r\n');self.assertEqual(data['table']['rows'][1],['1','2'])


class PdfTests(unittest.TestCase):
    def params(self,**args):return {'arguments':{'path':str(PDF),**args},'_meta':{'openai/resource':{'path':str(PDF)}}}

    def test_open_info_outline_and_file_entry(self):
        data=read_file(self.params())['structuredContent']
        self.assertEqual(data['kind'],'pdf');self.assertEqual(data['pageCount'],3)
        self.assertEqual([item['page'] for item in data['outline']],[1,2,3]);self.assertEqual(data['outline'][1]['level'],2)

    def test_real_page_render_highlights_and_mixed_sizes(self):
        data=read_pdf(self.params(page=1,scale=1,query='Robotics'))['structuredContent']
        self.assertTrue(base64.b64decode(data['blob']).startswith(b'\x89PNG'))
        self.assertTrue(data['boxes']);self.assertEqual(data['page'],1)
        wide=read_pdf(self.params(page=3,scale=1))['structuredContent']
        self.assertGreater(wide['pageWidth'],wide['pageHeight'])

    def test_search_chinese_case_insensitive_and_no_match(self):
        data=read_pdf(self.params(action='search',query='机器人'))['structuredContent']
        self.assertEqual([item['page'] for item in data['matches']],[2])
        data=read_pdf(self.params(action='search',query='robotics'))['structuredContent']
        self.assertEqual([item['page'] for item in data['matches']],[1,2,3])
        self.assertEqual(read_pdf(self.params(action='search',query='not-present-xyz'))['structuredContent']['matches'],[])

    def test_invalid_arguments_scope_revision_and_timeout(self):
        with self.assertRaises(ValueError):read_pdf({'arguments':{'path':str(PDF)}})
        for args in [{'page':True},{'page':0},{'scale':float('nan')},{'scale':5},{'query':'x'*201},{'action':'execute'},{'revision':'stale'}]:
            with self.assertRaises(ValueError):read_pdf(self.params(**args))
        with self.assertRaises(ValueError):read_pdf(self.params(page=4))
        with patch('pdf_reader.MAX_PDF_BYTES',1):
            with self.assertRaises(ValueError):read_pdf(self.params())
        with patch('pdf_reader.subprocess.run',side_effect=subprocess.TimeoutExpired('pdf',15)):
            with self.assertRaisesRegex(ValueError,'超时'):read_pdf(self.params())

    def test_corrupt_and_encrypted_leave_original_untouched(self):
        before=PDF.read_bytes()
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            bad=Path(directory)/'bad.pdf';bad.write_bytes(b'%PDF-1.7\nnot a PDF')
            with self.assertRaises(ValueError):pdf_job(bad,{'action':'info'})
            encrypted=Path(directory)/'encrypted.pdf'
            script="from pypdf import PdfReader,PdfWriter; import sys; r=PdfReader(sys.argv[1]); w=PdfWriter(); w.append_pages_from_reader(r); w.encrypt('secret'); w.write(sys.argv[2])"
            subprocess.run([str(DEFAULT_PYTHON),'-B','-c',script,str(PDF),str(encrypted)],check=True,capture_output=True)
            with self.assertRaisesRegex(ValueError,'加密'):pdf_job(encrypted,{'action':'info'})
        self.assertEqual(PDF.read_bytes(),before)


if __name__=='__main__':unittest.main()
