"""统一预览的只读文件访问，限定在宿主所选文件所在磁盘。"""
import base64
import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from image_reader import filesystem_path, image_mime, IMAGE_TYPES
from access_policy import checked_path

MARKDOWN = {'.md', '.markdown'}
TEXT = {'.txt', '.csv', '.tsv', '.log', '.json', '.yaml', '.yml', '.toml', '.py', '.pyw', '.pyi', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
        '.css', '.scss', '.html', '.htm', '.vue', '.sh', '.bash', '.ps1', '.bat', '.cmd', '.tex', '.ini', '.xml', '.c', '.cpp', '.h', '.hpp', '.java', '.go', '.rs', '.sql', '.ipynb', '.bib', '.rst'}
SUPPORTED = MARKDOWN | TEXT | set(IMAGE_TYPES) | {'.pdf'}
MAX_TEXT_BYTES = 8 * 1024 * 1024
MAX_PICTURE_BYTES = 40 * 1024 * 1024


@dataclass(frozen=True)
class DirectoryAnchor:
    path: Path


def selected_anchor(params):
    folder=params.get('_workspace_directory')
    if isinstance(folder, DirectoryAnchor):
        anchor=checked_path(folder.path).resolve(strict=True)
        if anchor.is_dir():return anchor
        raise ValueError('项目文件夹已不存在，请重新选择')
    metadata = (params.get('_meta') or {}).get('openai/resource') or {}
    anchor = filesystem_path(metadata.get('path'))
    if not anchor.is_absolute() or anchor.suffix.lower() not in SUPPORTED:
        raise ValueError('请先通过文件标签页打开本地文档或图片')
    anchor = anchor.resolve(strict=True)
    if not anchor.is_file():
        raise ValueError('宿主选中的文件不可用')
    return anchor


def selected_file(params, requested=None):
    anchor=selected_anchor(params)
    target = anchor
    if requested is not None:
        if not isinstance(requested, str) or not requested or len(requested) > 8192:
            raise ValueError('文件路径无效')
        target = filesystem_path(requested)
        if not target.is_absolute():
            target = (anchor if anchor.is_dir() else anchor.parent) / target
        target = checked_path(target).resolve(strict=True)
    if os.path.normcase(target.anchor) != os.path.normcase(anchor.anchor):
        raise ValueError('只能预览当前文件所在磁盘的文件')
    if not target.is_file() or target.suffix.lower() not in SUPPORTED:
        raise ValueError('此格式暂不能在本页预览，可双击交给应用打开')
    return target


def read_file(params):
    path = selected_file(params, (params.get('arguments') or {}).get('path'))
    suffix = path.suffix.lower()
    if suffix=='.pdf':
        from pdf_reader import pdf_job
        result={'path':str(path),'name':path.name,'kind':'pdf',**pdf_job(path,{'action':'info'})}
        return {'content':[{'type':'text','text':'已读取 PDF 页数和书签。'}],'structuredContent':result}
    picture = suffix in IMAGE_TYPES
    limit = MAX_PICTURE_BYTES if picture else MAX_TEXT_BYTES
    if path.stat().st_size > limit:
        raise ValueError('图片超过 40 MB' if picture else '文本超过 8 MB，无法在本页预览')
    with path.open('rb') as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError('文件超过预览大小限制')
    result = {'path': str(path), 'name': path.name, 'kind': 'image' if picture else 'markdown' if suffix in MARKDOWN else 'text'}
    if picture:
        result.update(mimeType=image_mime(path, data), blob=base64.b64encode(data).decode('ascii'))
    else:
        if b'\0' in data:
            raise ValueError('文件包含二进制数据，无法作为文本预览')
        try:
            result['text'] = data.decode('utf-8-sig')
            if suffix in MARKDOWN: result['revision'] = hashlib.sha256(data).hexdigest()
            if suffix in ('.csv','.tsv'):
                from csv_reader import csv_preview
                result['table']=csv_preview(result['text'],'\t' if suffix=='.tsv' else None)
        except UnicodeDecodeError:
            raise ValueError('文件不是 UTF-8 文本，暂不能在本页预览') from None
    return {'content': [{'type': 'text', 'text': '已读取所选文件。'}], 'structuredContent': result}
