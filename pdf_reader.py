"""Scoped PDF bridge. PDFium runs in a bounded separate process, never the MCP server."""
import json
import os
from pathlib import Path
import subprocess
import sys
from file_reader import selected_file

MAX_PDF_BYTES=64*1024*1024
_CODEX_PYTHON=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
# 优先保留已验证的 Codex PDF 环境；其他电脑可使用当前 Python 或显式指定的环境。
DEFAULT_PYTHON=Path(os.environ.get('FILE_WORKSPACE_PDF_PYTHON',str(_CODEX_PYTHON if _CODEX_PYTHON.is_file() else sys.executable)))


def pdf_revision(path):
    stat=path.stat()
    return f'{stat.st_mtime_ns}:{stat.st_size}'


def pdf_job(path, arguments):
    if path.suffix.lower()!='.pdf':raise ValueError('请选择 PDF 文件')
    if path.stat().st_size>MAX_PDF_BYTES:raise ValueError('PDF 超过 64 MB，暂不能在侧栏预览')
    with path.open('rb') as stream:
        if b'%PDF-' not in stream.read(1024):raise ValueError('文件不是有效的 PDF')
    revision=pdf_revision(path)
    if arguments.get('revision') and arguments['revision']!=revision:raise ValueError('PDF 已更新，请刷新文件后继续预览')
    python=Path(os.environ.get('FILE_WORKSPACE_PDF_PYTHON',str(DEFAULT_PYTHON)))
    if not python.is_file():raise ValueError('本机 PDF 运行时不可用，可双击交给应用打开')
    try:
        run=subprocess.run([str(python),'-B',str(Path(__file__).with_name('pdf_worker.py'))],
            input=json.dumps({'path':str(path),**arguments},ensure_ascii=False).encode('utf-8'),
            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired:raise ValueError('此 PDF 处理超时，可重试或双击交给应用打开') from None
    if run.returncode or len(run.stdout)>16*1024*1024:raise ValueError('此 PDF 无法渲染，可双击交给应用打开')
    try:data=json.loads(run.stdout.decode('utf-8'))
    except (ValueError,UnicodeError):raise ValueError('PDF 渲染服务返回异常') from None
    if data.get('error'):raise ValueError(data['error'])
    if pdf_revision(path)!=revision:raise ValueError('PDF 在读取时发生变化，请刷新文件')
    return {**data,'revision':revision}


def read_pdf(params):
    args=params.get('arguments') or {}
    path=selected_file(params,args.get('path'))
    action=args.get('action','page')
    if action not in ('info','page','search'):raise ValueError('PDF 操作无效')
    page=args.get('page',1);scale=args.get('scale',1.5);query=args.get('query','')
    if isinstance(page,bool) or not isinstance(page,int) or not 1<=page<=10000:raise ValueError('PDF 页码无效')
    if isinstance(scale,bool) or not isinstance(scale,(int,float)) or not .2<=scale<=4:raise ValueError('PDF 缩放无效')
    if not isinstance(query,str) or len(query)>200 or '\0' in query:raise ValueError('搜索文字无效或超过 200 字')
    result=pdf_job(path,{'action':action,'page':page,'scale':scale,'query':query,'revision':args.get('revision')})
    return {'content':[{'type':'text','text':'已读取所选 PDF。'}],'structuredContent':result}
