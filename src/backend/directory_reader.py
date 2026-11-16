"""List one local directory at a time for the preview's optional file browser."""
import os
from pathlib import Path
from image_reader import filesystem_path
from file_reader import selected_file, selected_anchor
from access_policy import checked_path, allowed_root

MAX_ENTRIES=500

def list_directory(params):
    arguments=params.get('arguments') or {}
    document=selected_file(params,arguments['documentPath']) if arguments.get('documentPath') else selected_anchor(params)
    requested=arguments.get('directory')
    if requested is not None and (not isinstance(requested,str) or len(requested)>8192):
        raise ValueError('目录路径无效')
    base=document if document.is_dir() else document.parent
    directory=base if not requested else filesystem_path(requested)
    if not directory.is_absolute():directory=base/directory
    directory=checked_path(directory).resolve(strict=True)
    if os.path.normcase(directory.anchor)!=os.path.normcase(document.anchor):
        raise ValueError('请浏览当前文档所在磁盘的目录')
    if not directory.is_dir():raise ValueError('选中的路径不是文件夹')
    entries=[];truncated=False
    with os.scandir(directory) as iterator:
        for entry in iterator:
            if len(entries)>=MAX_ENTRIES:truncated=True;break
            try:
                if entry.is_symlink():continue
                is_directory=entry.is_dir(follow_symlinks=False)
                if not is_directory and not entry.is_file(follow_symlinks=False):continue
                entries.append({'name':entry.name,'path':str(directory/entry.name),
                    'kind':'directory' if is_directory else 'file'})
            except OSError:continue
    entries.sort(key=lambda entry:(entry['kind']!='directory',entry['name'].casefold()))
    result={'directory':str(directory),'parent':str(directory.parent) if directory.parent!=directory and directory!=allowed_root() else None,
        'documentPath':None if document.is_dir() else str(document),'entries':entries,'truncated':truncated}
    return {'content':[{'type':'text','text':f'已列出当前文件夹中的 {len(entries)} 项。'}],'structuredContent':result}
