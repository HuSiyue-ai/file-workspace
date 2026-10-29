"""Protocol smoke test plus local host harness for UI verification."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from image_reader import read_images
from image_demo import prepare_demo
from server import dispatch

ROOT = Path(__file__).resolve().parent
PLUGIN = ROOT / 'plugins/markdown-math-preview'
SAMPLE = ROOT / 'examples/welcome.md'

def verify():
    requests = [
        {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}},
        {'jsonrpc':'2.0','method':'notifications/initialized'},
        {'jsonrpc':'2.0','id':2,'method':'tools/list'},
        {'jsonrpc':'2.0','id':3,'method':'resources/read','params':{'uri':'ui://markdown-math-preview/viewer.html'}},
        {'jsonrpc':'2.0','id':4,'method':'resources/read','params':{'uri':'file:///unauthorized.md'}}]
    run=subprocess.run([sys.executable,'-B',str(PLUGIN/'server.py')],input='\n'.join(json.dumps(x) for x in requests)+'\n',text=True,encoding='utf-8',capture_output=True,timeout=15,check=True)
    responses=[json.loads(x) for x in run.stdout.splitlines()]
    assert len(responses)==4 and not run.stderr
    assert responses[0]['result']['protocolVersion']=='2025-11-25'
    tool=responses[1]['result']['tools'][0]
    assert {'md','markdown','png','jpeg'}.issubset(tool['_meta']['openai/ui']['entrypoints'][0]['extensions'])
    assert tool['_meta']['ui']['visibility']==['app']
    assert responses[1]['result']['tools'][1]['name']=='read_markdown_images'
    assert responses[1]['result']['tools'][1]['_meta']['ui']['visibility']==['app']
    assert responses[1]['result']['tools'][2]['name']=='list_markdown_directory'
    assert responses[1]['result']['tools'][2]['_meta']['ui']['visibility']==['app']
    assert responses[1]['result']['tools'][3]['name']=='read_preview_file'
    assert responses[2]['result']['contents'][0]['mimeType']=='text/html;profile=mcp-app'
    assert 'error' in responses[3]
    print('PASS: stdio handshake, file entrypoint, offline UI resource, reject unrelated resources',flush=True)

HARNESS = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>查看器验证</title><style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style><iframe src="/viewer"></iframe><script>
const frame=document.querySelector('iframe');let original='';fetch('/sample').then(r=>r.text()).then(s=>original=s);
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.data?.jsonrpc!=='2.0')return;const m=e.data;const reply=result=>e.source.postMessage({jsonrpc:'2.0',id:m.id,result},'*');
if(m.method==='ui/initialize')reply({protocolVersion:'2025-11-21',hostInfo:{name:'Test host',version:'1'},hostCapabilities:{experimental:new URL(location.href).searchParams.get('fileOpen')==='0'?{}:{'openai/files':{}}},hostContext:{theme:'light'}});
if(m.method==='ui/notifications/initialized')Promise.all([fetch('/sample').then(r=>r.text()),fetch('/metadata').then(r=>r.json())]).then(([s,file])=>{original=s;e.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{file}}},'*');});
if(m.method==='resources/read')reply({contents:[{uri:m.params.uri,text:original,mimeType:'text/markdown'}]});
if(m.method==='tools/call')fetch('/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m.params)}).then(r=>r.json()).then(reply);
if(m.method==='openai/files/open'){document.documentElement.dataset.openedFile=m.params.path;reply({});}
});</script></html>'''

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path!='/images':self.send_error(404);return
        params=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        # Match the real desktop file tab's /C:/... host metadata, not a Python-native path.
        params['_meta']={'openai/resource':{'path':('/' if SAMPLE.drive else '')+SAMPLE.resolve().as_posix()}}
        try:result=dispatch('tools/call',params)
        except Exception as error:result={'isError':True,'content':[{'type':'text','text':str(error)}]}
        data=json.dumps(result,ensure_ascii=False).encode('utf-8')
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        if self.path.split('?',1)[0]=='/': data=HARNESS.encode();content_type='text/html; charset=utf-8'
        elif self.path=='/viewer':data=(PLUGIN/'viewer.html').read_bytes();content_type='text/html; charset=utf-8'
        elif self.path=='/sample':data=SAMPLE.read_bytes();content_type='text/plain; charset=utf-8'
        elif self.path=='/metadata':data=json.dumps({'name':SAMPLE.name,'resourceUri':'codex-resource://test/example.md'}).encode();content_type='application/json'
        else:self.send_error(404);return
        self.send_response(200);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def log_message(self,*args):pass

if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--serve',action='store_true');args.add_argument('--images',action='store_true');options=args.parse_args()
    if options.images:SAMPLE=prepare_demo(ROOT)
    verify()
    if options.serve:
        server=HTTPServer(('127.0.0.1',0),Handler);print(f'HARNESS http://127.0.0.1:{server.server_port}/',flush=True);server.serve_forever()
