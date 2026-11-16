"""Run deterministic local checks; never contacts GitHub or sends chat messages."""
import argparse
from pathlib import Path
import os
import shutil
import subprocess
import sys

from build import ROOT, PLUGIN

TESTS = ROOT / 'tests'


def call(*args, cwd=ROOT, env=None):
    print('CHECK '+Path(str(args[0])).name+' '+' '.join(map(str,args[1:])),flush=True)
    subprocess.run(list(map(str,args)),cwd=cwd,env=env,check=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--require-pdf',action='store_true')
    options=parser.parse_args()
    if sys.version_info<(3,12):raise SystemExit('Python 3.12+ is required.')
    node=os.environ.get('FILE_WORKSPACE_NODE') or shutil.which('node')
    if not node:raise SystemExit('Node.js is required for checks; set FILE_WORKSPACE_NODE or add node to PATH.')
    call(sys.executable,'-B','build.py')
    python_paths = [str(PLUGIN), str(ROOT)]
    if os.environ.get('PYTHONPATH'):
        python_paths.append(os.environ['PYTHONPATH'])
    test_env = {**os.environ, 'PYTHONPATH': os.pathsep.join(python_paths)}
    call(sys.executable,'-B','tests/verify_vendor.py',env=test_env)
    call(sys.executable,'-B','tests/verify.py',env=test_env)
    tests=[p.stem for p in sorted(TESTS.glob('test_*.py')) if p.stem!='test_formats']
    call(sys.executable,'-B','-m','unittest',*tests,cwd=TESTS,env=test_env)
    call(sys.executable,'-B','-m','unittest','test_formats.CsvTests',cwd=TESTS,env=test_env)
    sys.path.insert(0, str(PLUGIN))
    from pdf_reader import DEFAULT_PYTHON
    available=DEFAULT_PYTHON.is_file() and subprocess.run([str(DEFAULT_PYTHON),'-B','-c','import pypdfium2,pypdf; from PIL import Image'],capture_output=True).returncode==0
    if available:call(sys.executable,'-B','-m','unittest','test_formats.PdfTests',cwd=TESTS,env=test_env)
    elif options.require_pdf:raise SystemExit('PDF checks require pypdfium2, Pillow and pypdf in FILE_WORKSPACE_PDF_PYTHON.')
    else:print('SKIP optional PDF checks: install requirements-dev.txt to include them.',flush=True)
    for path in sorted(TESTS.glob('verify_*.cjs')):call(node,path.relative_to(ROOT))
    call(sys.executable,'-B','tests/verify_parser.py',env=test_env)
    print('PASS: all requested checks',flush=True)


if __name__=='__main__':main()
