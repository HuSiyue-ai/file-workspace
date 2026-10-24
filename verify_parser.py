"""SSR-check Markdown image destinations and KaTeX, then load the rendered refs."""
import html
import json
from pathlib import Path
import re
import subprocess
import os
import shutil
from build import module, VENDOR
from image_demo import prepare_demo
from image_reader import read_images

ROOT=Path(__file__).parent
_BUNDLED_NODE=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
NODE=os.environ.get('FILE_WORKSPACE_NODE') or shutil.which('node') or (_BUNDLED_NODE if _BUNDLED_NODE.is_file() else None)

def main():
    if NODE is None:raise SystemExit('Node.js is required for parser checks; set FILE_WORKSPACE_NODE or add node to PATH.')
    sample=prepare_demo(ROOT)
    parser=(ROOT/'markdown-parser.mjs').read_text(encoding='utf-8').split('export function attachMarkdownPreview')[0]
    parser=re.sub(r'^import .*?;\s*','',parser,flags=re.M).replace('export function','function')
    parser=parser.replace('src="${escape(imageUrl(href))}"','data-md-image-src="${escape(href)}"')
    program=module('marked.mjs',('Marked','B'))+module('katex/katex.mjs',('katex','katex'))+parser+'\nconsole.log(markdownHtml('+json.dumps(sample.read_text(encoding='utf-8'))+'));'
    run=subprocess.run([str(NODE),'-'],input=program,capture_output=True,text=True,encoding='utf-8',check=True)
    rendered=run.stdout
    refs=[html.unescape(value) for value in re.findall(r'data-md-image-src="([^"]+)"',rendered)]
    assert len(refs)==7,refs # HTML image remains raw before DOM sanitization.
    assert 'class="katex"' in rendered and 'class="katex-error"' not in rendered
    assert '<img src="http' not in rendered
    results=read_images({'arguments':{'sources':refs},'_meta':{'openai/resource':{'path':str(sample)}}})['structuredContent']['images']
    assert sum('blob' in result for result in results)==4,results
    assert sum('error' in result for result in results)==1,results
    print('PASS: Markdown renders local image references, wiki widths, reference images, code isolation and formulas; referenced files load correctly')
    script=(ROOT/'plugins/markdown-math-preview/viewer.html').read_text(encoding='utf-8').split('<script>',1)[1].rsplit('</script>',1)[0]
    syntax=subprocess.run([str(NODE),'--check'],input=script,text=True,encoding='utf-8',capture_output=True)
    assert syntax.returncode==0,syntax.stderr
    print('PASS: bundled viewer JavaScript syntax')

if __name__=='__main__':main()
