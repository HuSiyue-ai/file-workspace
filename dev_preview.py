"""Loopback-only UI host for fictional examples; chat requests are intercepted."""
from http.server import HTTPServer
import json
from pathlib import Path
from unittest.mock import patch
import server
import verify
import file_writer

ROOT=Path(__file__).resolve().parent
file_writer.BACKUP_ROOT=ROOT/'browser-save-backups'
PAGE=verify.HARNESS.replace("if(m.method==='ui/notifications/initialized')Promise.all",
    "if(m.method==='ui/notifications/initialized')return;\nif(false)Promise.all")
PAGE=PAGE.replace("hostCapabilities:{experimental:","hostCapabilities:{message:{text:{}},experimental:")
PAGE=PAGE.replace("{'openai/files':{}}","{'openai/files':{},'openai/message':{}}")
PAGE=PAGE.replace('<title>查看器验证</title>','<title>file-workspace demo</title>')
PAGE=PAGE.replace('<iframe src="/viewer">','<div id="demo-status" style="position:fixed;bottom:4px;left:4px;z-index:100;font:11px system-ui;color:#70747b;pointer-events:none"></div><iframe src="/viewer">')
PAGE=PAGE.replace("if(m.method==='openai/files/open')",
    "if(m.method==='ui/message'){document.getElementById('demo-status').textContent='测试宿主已截获草稿，没有发送至真实聊天';reply({});}\nif(m.method==='openai/files/open')")


class Handler(verify.Handler):
    def do_GET(self):
        if self.path.split('?',1)[0]!='/':return super().do_GET()
        self.reply(PAGE.encode('utf-8'),'text/html; charset=utf-8')

    def reply(self,data,mime='application/json; charset=utf-8'):
        self.send_response(200);self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
        self.end_headers();self.wfile.write(data)

    def do_POST(self):
        if self.path!='/images':self.send_error(404);return
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<=2*1024*1024:self.send_error(413);return
        params=json.loads(self.rfile.read(length))
        try:
            if params.get('name')=='get_workspace_start':
                with patch('workspace_launcher.project_roots',return_value=[ROOT/'examples']):result=server.dispatch('tools/call',params)
            else:result=server.dispatch('tools/call',params)
        except Exception as error:result={'isError':True,'content':[{'type':'text','text':str(error)}]}
        self.reply(json.dumps(result,ensure_ascii=False).encode('utf-8'))


if __name__=='__main__':
    host=HTTPServer(('127.0.0.1',0),Handler)
    print(f'LOCAL_DEMO http://127.0.0.1:{host.server_port}/',flush=True)
    print('仅供本机 UI 调试；Ctrl+C 停止。请不要把此调试服务暴露到公网。',flush=True)
    host.serve_forever()
