"""Local MCP stdio server with explicit version-checked Markdown saves; file data stays in the host UI bridge."""
import json
import sys
import time
from pathlib import Path
from image_reader import read_images
from directory_reader import list_directory
from directory_writer import create_directory
from file_reader import selected_anchor
from file_recycle import file_recycle
from file_operations import FileCopies, create_file, read_copy, reveal_file
from file_reader import read_file, TEXT
from file_writer import save_markdown
from pdf_reader import read_pdf
from image_reader import IMAGE_TYPES
from workspace_launcher import WorkspaceLauncher, SESSION_KEY
from ssh_workspaces import SSHWorkspaces
from ui_reload import UIUpdates

launcher = WorkspaceLauncher()
copies = FileCopies()
ssh_workspaces = SSHWorkspaces()
VERSION = Path(__file__).with_name('VERSION').read_text(encoding='utf-8').strip()
ui_updates = UIUpdates(Path(__file__).parent, VERSION)
MANAGED_WORKER = __name__ == '__main__' and sys.argv[1:] == ['--managed-worker']
remote_copy_tickets = {}

URI = 'ui://markdown-math-preview/viewer.html'
UPDATE_TOOL = {'name': 'read_workspace_update', 'title': '重载已安装的插件',
    'description': 'Check the installed file-workspace build. After the user confirms, apply switches to a compatible local backend and returns the verified UI.',
    'inputSchema': {'type': 'object', 'properties': {'apply': {'type': 'boolean'}}, 'additionalProperties': False},
    'annotations': {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False},
    '_meta': {'ui': {'visibility': ['app']}}}
MIME = 'text/html;profile=mcp-app'
TOOL = {
    'name':'open_markdown_preview','title':'file-workspace',
    'description':'Open the host-selected PDF, Markdown, image or UTF-8 text file in the unified file-workspace viewer.',
    'inputSchema':{'type':'object','properties':{'file':{'type':'object','properties':{'name':{'type':'string'},'resourceUri':{'type':'string'}},'required':['name','resourceUri']}},'required':['file']},
    'annotations':{'readOnlyHint':True,'destructiveHint':False,'openWorldHint':False},
    '_meta':{'ui':{'resourceUri':URI,'visibility':['app']},'openai/ui':{'entrypoints':[{'type':'file','extensions':['md','markdown','pdf',*[ext[1:] for ext in IMAGE_TYPES],*[ext[1:] for ext in sorted(TEXT)]]}]}}
}

IMAGE_TOOL = {'name':'read_markdown_images','title':'读取当前 Markdown 嵌入的本地图片',
    'description':'Load local images embedded in the host-selected Markdown file for display in its preview.',
    'inputSchema':{'type':'object','properties':{'documentPath':{'type':'string','maxLength':8192},'sources':{'type':'array','items':{'type':'string'},'maxItems':64}},'required':['sources']},
    'annotations':{'readOnlyHint':True,'destructiveHint':False,'openWorldHint':False},
    '_meta':{'ui':{'visibility':['app']}}}

DIRECTORY_TOOL = {'name':'list_markdown_directory','title':'浏览当前 Markdown 的本地目录',
    'description':'List one local directory on the selected document drive for the optional file browser; no recursive scan or file contents.',
    'inputSchema':{'type':'object','properties':{'directory':{'type':'string','maxLength':8192},'documentPath':{'type':'string','maxLength':8192}},'additionalProperties':False},
    'annotations':{'readOnlyHint':True,'destructiveHint':False,'openWorldHint':False},
    '_meta':{'ui':{'visibility':['app']}}}

FILE_TOOL = {'name':'read_preview_file','title':'在当前预览页读取选中的文件',
    'description':'Read a user-selected Markdown, image or UTF-8 text file on the host-opened file drive for in-place preview.',
    'inputSchema':{'type':'object','properties':{'path':{'type':'string','maxLength':8192}},'additionalProperties':False},
    'annotations':{'readOnlyHint':True,'destructiveHint':False,'openWorldHint':False},
    '_meta':{'ui':{'visibility':['app']}}}

SAVE_TOOL = {'name':'save_markdown_file','title':'保存正在编辑的 Markdown',
    'description':'Explicitly save a user-edited Markdown file on the host document drive after checking its SHA-256 revision; back up the original before replacing it.',
    'inputSchema':{'type':'object','properties':{'path':{'type':'string','maxLength':8192},'text':{'type':'string'},'revision':{'type':'string','minLength':64,'maxLength':64}},'required':['path','text','revision'],'additionalProperties':False},
    'annotations':{'readOnlyHint':False,'destructiveHint':False,'openWorldHint':False},
    '_meta':{'ui':{'visibility':['app']}}}

HOME_TOOL = {'name': 'open_file_workspace', 'title': 'file-workspace',
    'description': 'Open the local file-workspace start page in the conversation side panel.',
    'inputSchema': {'type': 'object', 'properties': {}, 'additionalProperties': False},
    'annotations': {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False},
    '_meta': {'ui': {'resourceUri': URI, 'visibility': ['app']},
              'openai/ui': {'entrypoints': [{'type': 'thread'}]}}}

PICK_TOOL = {'name': 'begin_workspace_file_selection', 'title': '打开本机文件选择框',
    'description': 'Show a native file dialog only after the user clicks Open file in the workspace UI.',
    'inputSchema': {'type': 'object', 'properties': {'kind':{'type':'string','enum':['file','directory','export-directory']}}, 'additionalProperties': False},
    'annotations': {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False},
    '_meta': {'ui': {'visibility': ['app']}}}

POLL_TOOL = {'name': 'poll_workspace_file_selection', 'title': '获取用户选择的文件',
    'description': 'Retrieve the result of this UI instance native file selection.',
    'inputSchema': {'type': 'object', 'properties': {'ticket': {'type': 'string', 'maxLength': 128}},
                    'required': ['ticket'], 'additionalProperties': False},
    'annotations': {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False},
    '_meta': {'ui': {'visibility': ['app']}}}

PDF_TOOL={'name':'read_pdf_preview','title':'读取当前 PDF 页面、书签和文字搜索',
    'description':'Read-only PDF page rendering or batched text search for the selected local PDF; no scripts or links are executed.',
    'inputSchema':{'type':'object','properties':{'path':{'type':'string','maxLength':8192},'action':{'type':'string','enum':['info','page','search']},'page':{'type':'integer','minimum':1,'maximum':10000},'scale':{'type':'number','minimum':0.2,'maximum':4},'query':{'type':'string','maxLength':200},'revision':{'type':'string','maxLength':100}},'additionalProperties':False},
    'annotations':{'readOnlyHint':True,'destructiveHint':False,'openWorldHint':False},'_meta':{'ui':{'visibility':['app']}}}

CREATE_DIRECTORY_TOOL={'name':'create_workspace_directory','title':'新建文件夹',
    'description':'Create one empty folder only after the user enters a name and clicks Create in the file-tree UI; never overwrite existing entries.',
    'inputSchema':{'type':'object','properties':{'parent':{'type':'string','maxLength':8192},'name':{'type':'string','minLength':1,'maxLength':120}},'required':['parent','name'],'additionalProperties':False},
    'annotations':{'readOnlyHint':False,'destructiveHint':False,'idempotentHint':False,'openWorldHint':False},'_meta':{'ui':{'visibility':['app']}}}

def operation_tool(name, title, properties, required, read_only=False, destructive=False):
    return {'name': name, 'title': title, 'description': title,
            'inputSchema': {'type': 'object', 'properties': properties, 'required': required, 'additionalProperties': False},
            'annotations': {'readOnlyHint': read_only, 'destructiveHint': destructive, 'openWorldHint': False},
            '_meta': {'ui': {'visibility': ['app']}}}


COPY_PATH = {'type': 'string', 'maxLength': 8192}
COPY_NAME = {'type': 'string', 'minLength': 1, 'maxLength': 120}
COPY_OFFSET = {'type': 'integer', 'minimum': 0, 'maximum': 256 * 1024 * 1024}
def recycle_selected_file(params):
    args = params['arguments']
    anchor = selected_anchor(params) if args.get('action') == 'delete' else None
    result = file_recycle(params)
    data = result['structuredContent']
    if anchor is not None and anchor == Path(data['path']):
        data['workspace'] = launcher.grant(anchor.parent, 'directory')['structuredContent']
    return result


FILE_OPERATIONS = [
    (operation_tool('recycle_workspace_file', '移到回收站或恢复文件',
                    {'action': {'enum': ['inspect', 'delete', 'list', 'restore']}, 'path': COPY_PATH,
                     'revision': {'type': 'string', 'maxLength': 256}, 'id': {'type': 'string', 'maxLength': 32}},
                    ['action'], destructive=True), recycle_selected_file),
    (operation_tool('create_workspace_file', '新建空文件', {'parent': COPY_PATH, 'name': COPY_NAME}, ['parent', 'name']), create_file),
    (operation_tool('reveal_workspace_file', '打开文件所在文件夹', {'path': COPY_PATH}, ['path'], True), reveal_file),
    (operation_tool('read_workspace_copy', '读取导出文件分块', {'path': COPY_PATH, 'offset': COPY_OFFSET,
                    'revision': {'type': 'string', 'maxLength': 256}}, ['path', 'offset'], True), read_copy),
    (operation_tool('write_workspace_copy', '写入文件副本分块', {'action': {'enum': ['begin', 'append', 'finish', 'abort']},
                    'parent': COPY_PATH, 'name': COPY_NAME, 'size': COPY_OFFSET, 'offset': COPY_OFFSET,
                    'ticket': {'type': 'string', 'maxLength': 128}, 'data': {'type': 'string', 'maxLength': 699052}}, ['action']), copies.write),
]
OPERATION_HANDLERS = {tool['name']: handler for tool, handler in FILE_OPERATIONS}

for workspace_tool in [IMAGE_TOOL, DIRECTORY_TOOL, FILE_TOOL, SAVE_TOOL, PDF_TOOL, CREATE_DIRECTORY_TOOL, *(tool for tool, _ in FILE_OPERATIONS)]:
    workspace_tool['inputSchema']['properties'][SESSION_KEY] = {'type': 'string', 'maxLength': 128}

CANCEL_TOOL = {**POLL_TOOL, 'name': 'cancel_workspace_file_selection', 'title': '关闭本页的文件选择框',
               'description': 'Cancel only the pending native picker owned by this UI ticket.'}

START_TOOL = {**HOME_TOOL, 'name':'get_workspace_start', 'title':'取得当前对话的项目文件夹',
              'description':'Resolve the host-supplied conversation project; an empty launcher may opt into the desktop selected-project fallback once when a new conversation has no saved context. No file contents are read.',
              'inputSchema':{'type':'object','properties':{'allowSelectedProject':{'type':'boolean'}},'additionalProperties':False},
              '_meta':{'ui':{'visibility':['app']}}}

def dispatch(method, params):
    if method == 'initialize':
        return {'protocolVersion':params.get('protocolVersion','2025-11-25'),'capabilities':{'tools':{},'resources':{}},'serverInfo':{'name':'markdown-math-preview','version':VERSION}}
    if method == 'ping': return {}
    if method == 'tools/list': return {'tools':[TOOL,IMAGE_TOOL,DIRECTORY_TOOL,FILE_TOOL,SAVE_TOOL,HOME_TOOL,PICK_TOOL,POLL_TOOL,CANCEL_TOOL,START_TOOL,PDF_TOOL,CREATE_DIRECTORY_TOOL,UPDATE_TOOL,*(tool for tool, _ in FILE_OPERATIONS)]}
    if method == 'resources/list': return {'resources':[{'uri':URI,'name':'file-workspace','mimeType':MIME}]}
    if method == 'resources/templates/list': return {'resourceTemplates':[]}
    if method == 'resources/read':
        if params.get('uri') != URI: raise ValueError('Unknown UI resource')
        html = Path(__file__).with_name('viewer.html').read_text(encoding='utf-8')
        return {'contents':[{'uri':URI,'mimeType':MIME,'text':html,'_meta':{'ui':{'csp':{'connectDomains':[],'resourceDomains':[]},'prefersBorder':False}}}]}
    if method == 'tools/call':
        if params.get('name') == UPDATE_TOOL['name']: return ui_updates.read()
        if params.get('name') == HOME_TOOL['name']: return {'content': [], 'structuredContent': {'home': True}}
        if params.get('name') == START_TOOL['name']: return ssh_workspaces.extend_start(launcher.start(params))
        if params.get('name') == PICK_TOOL['name']: return launcher.begin((params.get('arguments') or {}).get('kind','file'))
        if params.get('name') == POLL_TOOL['name']: return launcher.poll((params.get('arguments') or {}).get('ticket'))
        if params.get('name') == CANCEL_TOOL['name']: return launcher.cancel((params.get('arguments') or {}).get('ticket'))
        remote_result = ssh_workspaces.route(params)
        if remote_result is not None:
            if MANAGED_WORKER and params.get('name') == 'write_workspace_copy':
                remember_remote_copy(params['arguments'], remote_result)
            return remote_result
        params = launcher.authorize(params)
        handler = OPERATION_HANDLERS.get(params.get('name'))
        if handler is not None: return handler(params)
        if params.get('name') == CREATE_DIRECTORY_TOOL['name']: return create_directory(params)
        if params.get('name') == PDF_TOOL['name']: return read_pdf(params)
        if params.get('name') == SAVE_TOOL['name']: return save_markdown(params)
        if params.get('name') == FILE_TOOL['name']: return read_file(params)
        if params.get('name') == DIRECTORY_TOOL['name']: return list_directory(params)
        if params.get('name') == IMAGE_TOOL['name']: return read_images(params)
        if params.get('name') != TOOL['name']: raise ValueError('Unknown tool')
        return {'content':[{'type':'text','text':'文件已交给右侧 file-workspace 查看器。'}],'structuredContent':params.get('arguments',{})}
    raise LookupError('Method not found')

def remember_remote_copy(arguments, result):
    data = result.get('structuredContent') or {}
    if result.get('isError'):
        return
    action = arguments.get('action')
    ticket = data.get('ticket') if action == 'begin' else arguments.get('ticket')
    if ticket and action in ('begin', 'append'):
        remote_copy_tickets[ticket] = time.monotonic()
    elif action in ('finish', 'abort'):
        remote_copy_tickets.pop(ticket, None)


def worker_state(method, params):
    if method == 'file-workspace/worker/snapshot':
        now = time.monotonic()
        launcher.prune()
        copies.prune(now)
        for ticket, touched in list(remote_copy_tickets.items()):
            if now - touched > 600:
                remote_copy_tickets.pop(ticket)
        if launcher.picker or copies.pending or remote_copy_tickets:
            raise ValueError('请先完成其他标签中的文件选择或传输，再重载插件')
        return {'schema': 1, 'sessions': launcher.sessions, 'sshTokens': ssh_workspaces.tokens}
    if method == 'file-workspace/worker/restore' and params.get('schema') == 1:
        launcher.sessions = params['sessions']
        launcher.prune()
        for token, profile in params['sshTokens'].items():
            if profile in ssh_workspaces.profiles:
                # Retain the existing token for this exact configured SSH profile.
                current = next((key for key, value in ssh_workspaces.tokens.items() if value == profile), None)
                if current is not None:
                    ssh_workspaces.tokens.pop(current)
                ssh_workspaces.tokens[token] = profile
        return {}
    raise LookupError('Method not found')


def main():
    for line in sys.stdin.buffer:
        request = None
        try:
            request = json.loads(line)
            if 'id' not in request: continue
            method = request.get('method', '')
            params = request.get('params') or {}
            handler = worker_state if MANAGED_WORKER and method.startswith('file-workspace/worker/') else dispatch
            response = {'jsonrpc':'2.0','id':request['id'],'result':handler(method, params)}
        except Exception as error:
            response = {'jsonrpc':'2.0','id':request.get('id') if isinstance(request,dict) else None,
                'error':{'code':-32601 if isinstance(error,LookupError) else -32602,'message':str(error)}}
        sys.stdout.buffer.write((json.dumps(response,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8'))
        sys.stdout.buffer.flush()

if __name__ == '__main__': main()
