"""Locate the requesting conversation's ordered project roots, then its cwd.

The local state schema is an optional compatibility adapter, read-only. A fresh
launcher may explicitly opt into the desktop's selected project once; existing
conversation assignments always take precedence over that global fallback.
"""
from pathlib import Path
import re
import sqlite3
import json
import os
from contextlib import closing
from image_reader import filesystem_path


def local_directory(value):
    if isinstance(value, str) and re.match(r'^\\\\\?\\[A-Za-z]:[\\/]', value):
        value = value[4:]  # Local Windows extended path, never a UNC share/device.
    path = filesystem_path(value)
    if not path.is_absolute():
        raise ValueError('项目文件夹必须是本机绝对路径')
    path = path.resolve(strict=True)
    if not path.is_dir():
        raise ValueError('项目文件夹不可用')
    return path


def conversation_cwd(params, state_root=None):
    meta=params.get('_meta') or {}
    thread_id=meta.get('threadId') or meta.get('thread_id')
    if not isinstance(thread_id,str) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',thread_id):
        return None
    root=Path(state_root) if state_root is not None else Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex')))
    databases=sorted((p for p in root.glob('state_*.sqlite') if re.fullmatch(r'state_\d+\.sqlite',p.name)),
                     key=lambda p:int(p.stem.split('_')[-1]), reverse=True)
    for path in databases[:3]:
        try:
            with closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,timeout=.25)) as connection:
                connection.execute('PRAGMA query_only=ON')
                row=connection.execute('SELECT cwd FROM threads WHERE id = ? LIMIT 1',(thread_id,)).fetchone()
            if row:
                return local_directory(row[0])
        except (sqlite3.Error,ValueError,OSError):
            continue
    return None


def project_roots(params, state_root=None):
    roots = _project_roots(params, state_root)
    if roots:
        return roots
    fallback = os.environ.get('FILE_WORKSPACE_PROJECT_ROOT')
    return [local_directory(fallback)] if fallback else []


def _project_roots(params, state_root=None):
    """Prefer the assigned project's ordered roots over its runtime cwd.

    Never use the global selected project: another app window may change it.
    """
    meta=params.get('_meta') or {}
    thread_id=meta.get('threadId') or meta.get('thread_id')
    if not isinstance(thread_id,str) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',thread_id):return []
    root=Path(state_root) if state_root is not None else Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex')))
    try:
        with (root/'.codex-global-state.json').open('rb') as stream:data=stream.read(8*1024*1024+1)
        if len(data)>8*1024*1024:raise ValueError('state too large')
        state=json.loads(data.decode('utf-8'))
        assignment=state.get('thread-project-assignments',{}).get(thread_id)
        host=state.get('thread-project-membership-host-ids',{}).get(thread_id,'local')
        if isinstance(assignment,dict) and assignment.get('projectKind')=='local' and host=='local':
            project=state.get('local-projects',{}).get(assignment.get('projectId'))
            paths=project.get('rootPaths') if isinstance(project,dict) else None
            if isinstance(paths,list):
                result=[];seen=set()
                for value in paths[:32]:
                    try:
                        path=local_directory(value);key=os.path.normcase(str(path))
                        if key not in seen:result.append(path);seen.add(key)
                    except (ValueError,OSError,TypeError):continue
                if result:return result
    except (OSError,ValueError,AttributeError,TypeError):pass
    cwd=conversation_cwd(params,root)
    return [cwd] if cwd is not None else []


def current_project(params, state_root=None):
    roots=project_roots(params,state_root)
    return roots[0] if roots else None


def selected_project_roots(params, state_root=None):
    """One-shot draft fallback. Never follow this global selection after loading.

    Drafts use an ephemeral MCP host thread with no saved project/cwd. Do not
    replace known project, projectless or remote membership with another window's
    selection, and do not accept an arbitrary directory from UI arguments.
    """
    meta=params.get('_meta') or {}
    thread_id=meta.get('threadId') or meta.get('thread_id')
    if thread_id is not None and (not isinstance(thread_id,str) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',thread_id)):
        return []
    root=Path(state_root) if state_root is not None else Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex')))
    try:
        with (root/'.codex-global-state.json').open('rb') as stream:data=stream.read(8*1024*1024+1)
        if len(data)>8*1024*1024:return []
        state=json.loads(data.decode('utf-8'))
        if thread_id is not None:
            if thread_id in state.get('thread-project-assignments',{}):return []
            if thread_id in state.get('projectless-thread-ids',[]):return []
            if state.get('thread-project-membership-host-ids',{}).get(thread_id,'local')!='local':return []
        selected=state.get('selected-project')
        if not isinstance(selected,dict) or selected.get('type')!='local':return []
        project_id=selected.get('projectId')
        if not isinstance(project_id,str) or not project_id:return []
        project=state.get('local-projects',{}).get(project_id)
        paths=project.get('rootPaths') if isinstance(project,dict) else None
        if not isinstance(paths,list):return []
        result=[];seen=set()
        for value in paths[:32]:
            try:
                path=local_directory(value);key=os.path.normcase(str(path))
                if key not in seen:result.append(path);seen.add(key)
            except (ValueError,OSError,TypeError):continue
        return result
    except (OSError,ValueError,AttributeError,TypeError):return []
