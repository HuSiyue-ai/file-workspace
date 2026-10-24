"""Run deterministic local checks; never contacts GitHub or sends chat messages."""
import argparse
import importlib.util
from pathlib import Path
import os
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parent


def call(*args):
    print('CHECK '+Path(str(args[0])).name+' '+' '.join(map(str,args[1:])),flush=True)
    subprocess.run(list(map(str,args)),cwd=ROOT,check=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--require-pdf',action='store_true')
    options=parser.parse_args()
    if sys.version_info<(3,12):raise SystemExit('Python 3.12+ is required.')
    node=os.environ.get('FILE_WORKSPACE_NODE') or shutil.which('node')
    if not node:raise SystemExit('Node.js is required for checks; set FILE_WORKSPACE_NODE or add node to PATH.')
    call(sys.executable,'-B','build.py')
    call(sys.executable,'-B','verify_vendor.py')
    call(sys.executable,'-B','verify.py')
    tests=[p.stem for p in sorted(ROOT.glob('test_*.py')) if p.stem!='test_formats']
    call(sys.executable,'-B','-m','unittest',*tests)
    call(sys.executable,'-B','-m','unittest','test_formats.CsvTests')
    from pdf_reader import DEFAULT_PYTHON
    available=DEFAULT_PYTHON.is_file() and subprocess.run([str(DEFAULT_PYTHON),'-B','-c','import pypdfium2,pypdf; from PIL import Image'],capture_output=True).returncode==0
    if available:call(sys.executable,'-B','-m','unittest','test_formats.PdfTests')
    elif options.require_pdf:raise SystemExit('PDF checks require pypdfium2, Pillow and pypdf in FILE_WORKSPACE_PDF_PYTHON.')
    else:print('SKIP optional PDF checks: install requirements-dev.txt to include them.',flush=True)
    for path in sorted(ROOT.glob('verify_*.cjs')):call(node,path.name)
    call(sys.executable,'-B','verify_parser.py')
    print('PASS: all requested checks',flush=True)


if __name__=='__main__':main()
