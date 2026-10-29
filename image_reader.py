"""Read images embedded in the host-selected local Markdown document."""
import base64
import html
import os
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from access_policy import checked_path

MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_BATCH_BYTES = 32 * 1024 * 1024
IMAGE_TYPES = {'.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
    '.webp':'image/webp', '.svg':'image/svg+xml', '.bmp':'image/bmp', '.ico':'image/x-icon', '.avif':'image/avif'}

def filesystem_path(value):
    """Translate a host path or file URI into the local OS's filesystem syntax."""
    if not isinstance(value,str) or not value or '\x00' in value:
        raise ValueError('文件路径为空或无效')
    if value.lower().startswith('file:'):
        url=urlsplit(value)
        if url.netloc and url.netloc.lower()!='localhost':
            raise ValueError('暂不读取网络共享文件')
        value=unquote(url.path)
    if os.name=='nt' and re.match(r'^/[A-Za-z]:[/\\]',value):
        # The app's file-link and file-tab paths use /C:/..., unlike pathlib on Windows.
        value=value[1:]
    if value.startswith(('\\\\','//')):
        raise ValueError('暂不读取网络共享文件')
    path = Path(value)
    return checked_path(path) if path.is_absolute() else path

class ImageTags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sources = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'img':
            self.sources.extend(value for key,value in attrs if key.lower()=='src' and value)

def destination(text):
    text = text.lstrip()
    if text.startswith('<'):
        end = text.find('>')
        return text[1:end] if end >= 0 else ''
    depth, chars, index = 0, [], 0
    while index < len(text):
        char = text[index]
        if char == '\\' and index+1<len(text) and text[index+1] in '()[] ':
            chars.extend(text[index:index+2]);index+=2;continue
        if char == '(' : depth += 1
        if char == ')':
            if depth == 0: break
            depth -= 1
        if char.isspace() and depth == 0: break
        chars.append(char);index+=1
    return ''.join(chars)

def image_references(text):
    text=text.replace('\r\n','\n').replace('\r','\n')
    # Fenced code is displayed literally; its example paths are not embedded images.
    text=re.sub(r'(?ms)^ {0,3}(`{3,}|~{3,})[^\n]*\n.*?^ {0,3}\1[ \t]*(?:\n|$)','',text)
    refs = []
    for match in re.finditer(r'!\[(?:\\.|[^\]\\])*\]\(', text):
        source = destination(text[match.end():])
        if source: refs.append(source)
    definitions = {m[1].strip().casefold():destination(m[2]) for m in re.finditer(r'^ {0,3}\[([^\]]+)\]:\s*(.+)$', text, re.M)}
    for match in re.finditer(r'!\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()', text):
        key = (match[2] or match[1]).strip().casefold()
        if key in definitions: refs.append(definitions[key])
    refs.extend(m[1].split('|',1)[0].strip() for m in re.finditer(r'!\[\[([^\]\n]+)\]\]', text))
    tags = ImageTags(); tags.feed(text); refs.extend(tags.sources)
    return refs

def local_path(source, document):
    raw = html.unescape(source).strip()
    if not raw or '\x00' in raw: raise ValueError('图片路径为空或无效')
    if raw.startswith(('\\\\','//')): raise ValueError('暂不读取网络共享图片')
    if raw.lower().startswith('file:'):
        url = urlsplit(raw)
        if url.netloc and url.netloc.lower() != 'localhost': raise ValueError('暂不读取网络共享图片')
        value = unquote(url.path)
        if re.match(r'^/[A-Za-z]:[/\\]', value): value=value[1:]
    elif re.match(r'^[A-Za-z]:[/\\]', raw): value = unquote(raw)
    else:
        url = urlsplit(raw)
        if url.scheme or url.netloc: raise ValueError('仅加载本地嵌入图片')
        literal = checked_path(document.parent / unquote(raw))
        value = unquote(raw if literal.is_file() else url.path)
    value = re.sub(r'\\([()\[\] ])', r'\1', value)
    if value.startswith(('\\\\','//')): raise ValueError('暂不读取网络共享图片')
    path = filesystem_path(value)
    if not path.is_absolute(): path = document.parent / path
    return checked_path(path.resolve())

def image_mime(path, data):
    if path.suffix.lower() not in IMAGE_TYPES: raise ValueError('暂不支持此图片格式')
    # Exported screenshots can have a .png filename while containing JPEG bytes.
    # Send the actual encoding to the browser; never rewrite the user's image.
    signatures = {
        'image/png':data.startswith(b'\x89PNG\r\n\x1a\n'),
        'image/jpeg':data.startswith(b'\xff\xd8\xff'),
        'image/gif':data.startswith((b'GIF87a',b'GIF89a')),
        'image/webp':data.startswith(b'RIFF') and data[8:12]==b'WEBP',
        'image/bmp':data.startswith(b'BM'),
        'image/x-icon':data.startswith(b'\x00\x00\x01\x00'),
        'image/avif':data[4:8]==b'ftyp' and any(brand in data[8:64] for brand in (b'avif',b'avis')),
        'image/svg+xml':bool(re.search(br'<svg(?:\s|>)',data[:8192],re.I)),
    }
    for mime, matches in signatures.items():
        if matches: return mime
    raise ValueError('无法识别图片内容，文件可能损坏或使用了暂不支持的格式')

def read_images(params):
    requested_document = (params.get('arguments') or {}).get('documentPath')
    if requested_document is not None:
        from file_reader import selected_file
        target = selected_file(params, requested_document)
        if target.suffix.lower() not in ('.md', '.markdown'):
            raise ValueError('嵌入图片只能从 Markdown 文档读取')
        params = {**params, '_meta': {**(params.get('_meta') or {}), 'openai/resource': {'path': str(target)}}}
    metadata = (params.get('_meta') or {}).get('openai/resource') or {}
    selected_path = metadata.get('path')
    if not isinstance(selected_path,str) or not selected_path:
        raise ValueError('未收到当前文件的本地路径，请重新打开 Markdown 文件标签页')
    document = filesystem_path(selected_path)
    if not document.is_absolute() or document.suffix.lower() not in ('.md','.markdown'):
        raise ValueError('当前文件不是本地 Markdown 文件')
    document = document.resolve(strict=True)
    sources = (params.get('arguments') or {}).get('sources')
    if not isinstance(sources,list) or len(sources)>64 or any(not isinstance(s,str) or len(s)>8192 for s in sources):
        raise ValueError('图片列表无效')
    referenced = set()
    for reference in image_references(document.read_text(encoding='utf-8-sig')):
        try: referenced.add(local_path(reference,document))
        except (ValueError,OSError): pass
    images, total = [], 0
    for source in dict.fromkeys(sources):
        try:
            path = local_path(source,document)
            if path not in referenced: raise ValueError('图片未嵌入当前 Markdown 文件')
            if path.suffix.lower() not in IMAGE_TYPES: raise ValueError('暂不支持此图片格式')
            if not path.is_file(): raise ValueError('找不到图片，请检查文件位置和路径')
            size = path.stat().st_size
            if size>MAX_IMAGE_BYTES: raise ValueError('图片超过 20 MB，请使用较小图片')
            if total+size>MAX_BATCH_BYTES: raise ValueError('本批图片超过 32 MB，请减少或压缩图片')
            with path.open('rb') as stream: data=stream.read(MAX_IMAGE_BYTES+1)
            if len(data)>MAX_IMAGE_BYTES: raise ValueError('图片超过 20 MB')
            mime=image_mime(path,data);total+=len(data)
            images.append({'source':source,'mimeType':mime,'blob':base64.b64encode(data).decode('ascii')})
        except (OSError,ValueError) as error:
            message = str(error) if isinstance(error,ValueError) else '图片无法读取，请检查路径和读取权限'
            images.append({'source':source,'error':message})
    return {'content':[{'type':'text','text':f'已加载 {sum("blob" in image for image in images)} 张本地图片。'}],
        'structuredContent':{'images':images}}
