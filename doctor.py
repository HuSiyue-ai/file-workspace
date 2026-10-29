"""Read-only local prerequisite check. Never installs packages or edits settings."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
from pdf_reader import DEFAULT_PYTHON


def main():
    root=Path(__file__).resolve().parent
    pdf=False
    if DEFAULT_PYTHON.is_file():
        run=subprocess.run([str(DEFAULT_PYTHON),'-B','-c','import pypdfium2; from PIL import Image'],capture_output=True,timeout=15,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        pdf=run.returncode==0
    plugin=root/'plugins/markdown-math-preview'
    settings = json.loads((plugin/'.mcp.json').read_text(encoding='utf-8')) if (plugin/'.mcp.json').is_file() else {}
    env = settings.get('mcpServers',{}).get('markdown-math-preview',{}).get('env',{})
    print(json.dumps({'python':sys.version.split()[0],'pythonSupported':sys.version_info>=(3,12),
        'tkinterAvailable':importlib.util.find_spec('tkinter') is not None,
        'codexCliOnPath':shutil.which('codex') is not None,'nodeOnPath':shutil.which('node') is not None,
        'built':(plugin/'viewer.html').is_file() and (plugin/'.mcp.json').is_file(),
        'headless':env.get('FILE_WORKSPACE_HEADLESS')=='1',
        'projectRoot':env.get('FILE_WORKSPACE_PROJECT_ROOT'), 'allowedRoot':env.get('FILE_WORKSPACE_ALLOWED_ROOT'),
        'pdfAvailable':pdf,'pdfPython':str(DEFAULT_PYTHON)},ensure_ascii=False,indent=2))
    if sys.version_info<(3,12):raise SystemExit('Python 3.12+ is required.')
    if not pdf:print('PDF is optional: install requirements-pdf.txt in the chosen Python environment.')


if __name__=='__main__':main()
