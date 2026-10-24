"""Create one explicitly named child directory; never replace existing entries."""
import os
import re
from pathlib import Path
from file_reader import selected_anchor
from image_reader import filesystem_path


def folder_name(value):
    if not isinstance(value,str) or not value or value!=value.strip() or value.endswith('.'):
        raise ValueError('请输入文件夹名称，首尾不能有空格，末尾不能是句点')
    if value in ('.','..') or any(ord(char)<32 or char in '<>:"/\\|?*' for char in value):
        raise ValueError('名称不能包含路径分隔符或 Windows 不允许的字符')
    if re.fullmatch(r'CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³]',value.split('.')[0].rstrip(' '),re.I):
        raise ValueError('此名称由 Windows 保留，请换一个名称')
    try: length=len(value.encode('utf-16-le'))//2
    except UnicodeError: raise ValueError('文件夹名称包含无效字符') from None
    if length>120:raise ValueError('文件夹名称过长，请限制在 120 个字符以内')
    return value


def plain_parent(path):
    # 写入操作拒绝符号链接、junction 和其他重解析点，不沿链接建立目录。
    for part in (path,*path.parents):
        stat=part.lstat()
        if part.is_symlink() or getattr(stat,'st_file_attributes',0)&0x400:
            raise ValueError('暂不支持在链接或重解析点文件夹中创建，请选择实际文件夹')
    resolved=path.resolve(strict=True)
    if not resolved.is_dir():raise ValueError('创建位置不是文件夹')
    return resolved


def create_directory(params):
    args=params.get('arguments') or {}
    anchor=selected_anchor(params)
    name=folder_name(args.get('name'))
    parent=args.get('parent')
    if not isinstance(parent,str) or not parent or len(parent)>8192:raise ValueError('请选择创建位置')
    parent=filesystem_path(parent)
    if not parent.is_absolute() or '..' in parent.parts or os.path.normcase(parent.anchor)!=os.path.normcase(anchor.anchor):
        raise ValueError('只能在当前项目所在磁盘的实际文件夹中创建')
    try:
        parent=plain_parent(parent)
        target=parent/name
        # parents=False / exist_ok=False：同名文件与文件夹均拒绝，不做覆盖或自动改名。
        target.mkdir(parents=False,exist_ok=False)
    except FileExistsError:raise ValueError('已有同名文件或文件夹，请换一个名称') from None
    except PermissionError:raise ValueError('没有权限在此位置新建文件夹，请选择其他位置') from None
    except FileNotFoundError:raise ValueError('创建位置已不存在，请刷新文件树') from None
    except OSError as error:raise ValueError('无法创建文件夹，请检查位置、名称或磁盘状态') from error
    result={'created':True,'parent':str(parent),'path':str(target),'name':name}
    return {'content':[{'type':'text','text':'已新建文件夹。'}],'structuredContent':result}
