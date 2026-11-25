"""Read the requesting conversation's project and offer saved project choices."""
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


def thread_identifier(params):
    meta=params.get('_meta') or {}
    thread_id=meta.get('threadId') or meta.get('thread_id')
    return thread_id if isinstance(thread_id,str) and re.fullmatch(
        r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',thread_id) else None


def state_directory(state_root):
    return Path(state_root) if state_root is not None else Path(os.environ.get('CODEX_HOME', Path.home()/'.codex'))


def query_state(root, query, args=()):
    databases = sorted((path for path in root.glob('state_*.sqlite')
                        if re.fullmatch(r'state_\d+\.sqlite',path.name)),
                       key=lambda path:int(path.stem.split('_')[-1]), reverse=True)
    for path in databases[:3]:
        try:
            with closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,timeout=.25)) as connection:
                connection.execute('PRAGMA query_only=ON')
                rows=connection.execute(query,args).fetchall()
            if rows:
                return rows
        except (sqlite3.Error, ValueError, OSError):
            continue
    return []


def desktop_state(root):
    try:
        with (root/'.codex-global-state.json').open('rb') as stream:
            data=stream.read(8*1024*1024+1)
        if len(data)<=8*1024*1024:
            state=json.loads(data.decode('utf-8'))
            if isinstance(state,dict):
                return state
    except (OSError, ValueError):
        pass
    return {}


def ordered_directories(values):
    result={}
    for value in values:
        try:
            path=local_directory(value)
        except (ValueError,OSError,TypeError):
            continue
        result.setdefault(os.path.normcase(str(path)),path)
    return list(result.values())


def project_roots(params, state_root=None):
    roots = _project_roots(params, state_root)
    if roots:
        return roots
    fallback = os.environ.get('FILE_WORKSPACE_PROJECT_ROOT')
    return [local_directory(fallback)] if fallback else []


def _project_roots(params, state_root=None):
    thread_id=thread_identifier(params)
    if thread_id is None:
        return []
    root=state_directory(state_root)
    state=desktop_state(root)
    try:
        assignment=state.get('thread-project-assignments',{}).get(thread_id)
        host=state.get('thread-project-membership-host-ids',{}).get(thread_id,'local')
        if host!='local' or (isinstance(assignment,dict) and assignment.get('projectKind')=='remote'):
            return []
        rows=query_state(root, '''SELECT r.path FROM threads t JOIN project_roots r ON r.project_id=t.project_id
                                 WHERE t.id=? ORDER BY r.position LIMIT 32''', (thread_id,))
        if roots:=ordered_directories(row[0] for row in rows):
            return roots
        if isinstance(assignment,dict) and assignment.get('projectKind')=='local':
            project=state.get('local-projects',{}).get(assignment.get('projectId'))
            paths=project.get('rootPaths') if isinstance(project,dict) else None
            if isinstance(paths,list) and (roots:=ordered_directories(paths[:32])):
                return roots
    except (OSError,ValueError,AttributeError,TypeError):pass
    rows=query_state(root,'SELECT cwd FROM threads WHERE id = ? LIMIT 1',(thread_id,))
    return ordered_directories(row[0] for row in rows)


def current_project(params, state_root=None):
    roots=project_roots(params,state_root)
    return roots[0] if roots else None


def desktop_project_choices(state_root=None):
    """List saved projects for explicit selection when a draft has no identity."""
    root=state_directory(state_root)
    rows=query_state(root, '''SELECT p.id,p.name,r.path FROM projects p JOIN project_roots r ON r.project_id=p.id
                             ORDER BY p.position,r.position LIMIT 256''')
    projects={}
    for project_id,name,path in rows:
        projects.setdefault(project_id,(name,[]))[1].append(path)
    if not projects:
        legacy=desktop_state(root).get('local-projects')
        if isinstance(legacy,dict):
            projects={key:(item.get('name'),item['rootPaths']) for key,item in legacy.items()
                      if isinstance(item,dict) and isinstance(item.get('rootPaths'),list)}
    choices={}
    for name,paths in projects.values():
        for index,path in enumerate(ordered_directories(paths[:32])):
            label=name.strip() if isinstance(name,str) else ''
            label=(label+' · '+path.name) if label and index else label
            choices.setdefault(os.path.normcase(str(path)),(path,label or path.name or str(path)))
            if len(choices)>=32:
                return list(choices.values())
    return list(choices.values())
