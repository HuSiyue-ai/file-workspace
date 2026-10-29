"""真实浏览器回归：目录单击原位切换，双击请求原生打开。仅监听回环地址。"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import shutil
from server import dispatch
import file_writer

ROOT=Path(__file__).resolve().parent
file_writer.BACKUP_ROOT=ROOT/'browser-save-backups'
FIXTURES=ROOT/'文件树紧凑工具栏与超长根文件夹名称测试';FIXTURES.mkdir(exist_ok=True)
SAMPLE=FIXTURES/'预览入口.md'
SAMPLE.write_text('# 统一预览测试\n\n公式 $E=mc^2$。\n\n## 第一节\n\n单击目录中的图片或第二篇文档。\n'+''.join(f'\n## 长文第 {index} 节\n\n'+('用于检查正文独立滚动，目录不随正文滚动。'*6)+'\n' for index in range(1,30)),encoding='utf-8')
(FIXTURES/'第二篇.md').write_text('# 第二篇文档\n\n公式 $\\frac{a}{b}$。\n\n## 本地图片\n\n![切换后读取的图片](图片.png)\n',encoding='utf-8')
(FIXTURES/'说明.txt').write_text('这是一份普通文本。\n单击在当前页阅读。\n',encoding='utf-8')
(FIXTURES/'暂不支持.pdf').write_bytes(b'%PDF fixture, unsupported in-page')
PICTURE=ROOT/'examples/sample.png'
assert PICTURE.is_file();shutil.copy2(PICTURE,FIXTURES/'图片.png')
for dirname in ['资料甲','资料乙']:
    folder=FIXTURES/dirname;folder.mkdir(exist_ok=True)
    (folder/'子目录').mkdir(exist_ok=True)
    (folder/'子目录'/'深层笔记.md').write_text('# 深层笔记\n\n目录应保留两个展开的分支。\n',encoding='utf-8')
    for index in range(1,21):
        (folder/f'笔记{index:02d}.md').write_text(f'# {dirname}笔记{index:02d}\n\n公式 $E=mc^2$。\n',encoding='utf-8')
PAGE=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>统一文件预览回归</title>
<style>html,body{height:100%;margin:0;font:13px system-ui}body{display:flex;flex-direction:column}#opens{padding:5px 10px;margin:0;background:#f4f6f8}iframe{flex:1;width:100%;min-height:0;border:0}</style>
<div><button id="narrow">窄窗口 480</button><button id="wide">恢复宽窗口</button><button id="dark">深色主题</button><button id="light">浅色主题</button></div><pre id="opens">原生打开请求：0</pre><pre id="drafts">草稿请求：0</pre><iframe src="/viewer"></iframe><script>
const frame=document.querySelector('iframe');let count=0,draftCount=0;
document.getElementById('narrow').onclick=()=>frame.style.width='480px';
document.getElementById('wide').onclick=()=>frame.style.width='100%';
for(const theme of ['dark','light'])document.getElementById(theme).onclick=()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/host-context-changed',params:{theme}},'*');
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.jsonrpc!=='2.0')return;const value=event.data;
 const reply=result=>event.source.postMessage({jsonrpc:'2.0',id:value.id,result},'*');
 if(value.method==='ui/initialize')reply({protocolVersion:'2025-11-21',hostInfo:{name:'Unified test host',version:'1'},hostCapabilities:{message:{text:{}},experimental:{'openai/files':{},'openai/message':{}}},hostContext:{theme:'light'}});
 if(value.method==='ui/notifications/initialized'){const file=await(await fetch('/metadata')).json();event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{file}}},'*');}
 if(value.method==='tools/call')reply(await(await fetch('/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value.params)})).json());
 if(value.method==='openai/files/open'){document.getElementById('opens').textContent='原生打开请求：'+(++count)+'\n'+value.params.path;reply({});}
 if(value.method==='ui/message'){document.getElementById('drafts').textContent='草稿请求：'+(++draftCount)+'\n'+JSON.stringify(value.params);reply({});}
});</script></html>'''

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/':data=PAGE.encode();mime='text/html; charset=utf-8'
        elif self.path=='/viewer':data=(ROOT/'plugins/markdown-math-preview/viewer.html').read_bytes();mime='text/html; charset=utf-8'
        elif self.path=='/metadata':data=json.dumps({'name':SAMPLE.name,'resourceUri':'fixture:entry'}).encode();mime='application/json'
        else:self.send_error(404);return
        self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
        if self.path=='/viewer':self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:;")
        self.end_headers();self.wfile.write(data)
    def do_POST(self):
        if self.path!='/call':self.send_error(404);return
        params=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        params['_meta']={'openai/resource':{'path':('/' if SAMPLE.drive else '')+SAMPLE.as_posix()}}
        try:result=dispatch('tools/call',params)
        except Exception as error:result={'isError':True,'content':[{'type':'text','text':str(error)}]}
        data=json.dumps(result,ensure_ascii=False).encode('utf-8');self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def log_message(self,*_):pass

if __name__=='__main__':
    server=HTTPServer(('127.0.0.1',0),Handler);print(f'HARNESS http://127.0.0.1:{server.server_port}/',flush=True);server.serve_forever()
