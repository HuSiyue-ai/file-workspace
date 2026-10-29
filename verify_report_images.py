"""Test a real report through the MCP server, preserving every source byte."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from image_reader import image_references, local_path

def main():
    parser=argparse.ArgumentParser();parser.add_argument('document');options=parser.parse_args()
    document=Path(options.document).resolve(strict=True)
    document_before=document.read_bytes()
    sources=list(dict.fromkeys(image_references(document_before.decode('utf-8-sig'))))
    files={source:local_path(source,document) for source in sources}
    original={source:hashlib.sha256(path.read_bytes()).hexdigest() for source,path in files.items()}
    requests=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}},
        {'jsonrpc':'2.0','method':'notifications/initialized'},
        {'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'read_markdown_images','arguments':{'sources':sources},
            '_meta':{'openai/resource':{'path':('/' if document.drive else '')+document.as_posix()}}}}]
    server=Path(__file__).parent/'plugins/markdown-math-preview/server.py'
    process=subprocess.run([sys.executable,'-B',str(server)],input='\n'.join(json.dumps(request) for request in requests)+'\n',
        capture_output=True,text=True,encoding='utf-8',check=True,timeout=15)
    responses=[json.loads(line) for line in process.stdout.splitlines()]
    assert 'result' in responses[1],responses[1].get('error')
    images=responses[1]['result']['structuredContent']['images']
    assert len(images)==len(sources)
    for image in images:
        assert 'blob' in image,(image['source'],image.get('error'))
        data=base64.b64decode(image['blob'])
        assert hashlib.sha256(data).hexdigest()==original[image['source']]
        assert hashlib.sha256(files[image['source']].read_bytes()).hexdigest()==original[image['source']]
        if data.startswith(b'\xff\xd8\xff'):assert image['mimeType']=='image/jpeg'
        print(json.dumps({'image':files[image['source']].name,'mimeType':image['mimeType'],'bytes':len(data)},ensure_ascii=True))
    assert document.read_bytes()==document_before
    print(f'PASS: all {len(images)} embedded report images returned with actual MIME type; report and images unchanged')

if __name__=='__main__':main()
