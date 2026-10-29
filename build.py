"""Build an offline MCP file viewer from the already verified local vendor assets."""
from pathlib import Path
import argparse
import base64
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parent
PLUGIN = ROOT / 'plugins' / 'markdown-math-preview'
VENDOR = ROOT / 'vendor'

def server_environment(options):
    local_env = ROOT / '.runtime/server-env.json'
    env = json.loads(local_env.read_text(encoding='utf-8')) if local_env.is_file() else {}
    allowed = {'CODEX_HOME', 'FILE_WORKSPACE_PROJECT_ROOT', 'FILE_WORKSPACE_ALLOWED_ROOT',
               'FILE_WORKSPACE_HEADLESS', 'FILE_WORKSPACE_BACKUP_ROOT'}
    if not isinstance(env, dict) or set(env) - allowed or any(not isinstance(v, str) for v in env.values()):
        raise ValueError('Invalid local server environment')
    for value, key in [(options.project_root, 'FILE_WORKSPACE_PROJECT_ROOT'),
                       (options.allowed_root, 'FILE_WORKSPACE_ALLOWED_ROOT')]:
        if value is not None:
            path = Path(value)
            if not path.is_absolute() or not path.is_dir():
                raise ValueError(f'{key} must be an existing absolute directory')
            env[key] = str(path.resolve(strict=True))
    if options.headless:
        env['FILE_WORKSPACE_HEADLESS'] = '1'
    if env.get('FILE_WORKSPACE_ALLOWED_ROOT') and env.get('FILE_WORKSPACE_PROJECT_ROOT'):
        if not Path(env['FILE_WORKSPACE_PROJECT_ROOT']).resolve().is_relative_to(Path(env['FILE_WORKSPACE_ALLOWED_ROOT']).resolve()):
            raise ValueError('The project root must be inside the allowed root')
    if options.project_root is not None or options.allowed_root is not None or options.headless:
        local_env.parent.mkdir(parents=True, exist_ok=True)
        local_env.write_text(json.dumps(env, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return env

def module(filename, result):
    source = (VENDOR / filename).read_text(encoding='utf-8')
    source, count = re.subn(r'export\s*\{[^}]*\}\s*;?', '', source)
    assert count == 1, filename
    return 'const ' + result[0] + '=(()=>{\n' + source + '\nreturn ' + result[1] + ';})();\n'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', help='Explicit fallback project directory for SSH/headless use')
    parser.add_argument('--allowed-root', help='Restrict document, directory and image access to this directory')
    parser.add_argument('--headless', action='store_true', help='Disable native GUI file dialogs')
    options = parser.parse_args()
    env = server_environment(options)
    PLUGIN.mkdir(parents=True, exist_ok=True)
    css = (VENDOR / 'katex/katex.min.css').read_text(encoding='utf-8')
    # This vendor package includes WOFF2 only; avoid any unresolved fallback URLs.
    css = re.sub(r'url\(fonts/([^)]*\.woff2)\) format\("woff2"\)(?:,url\([^)]*\) format\("woff"\),url\([^)]*\) format\("truetype"\))?',
        lambda match: 'url(data:font/woff2;base64,' + base64.b64encode((VENDOR / 'katex/fonts' / match[1]).read_bytes()).decode() + ') format("woff2")', css)
    assert 'url(fonts/' not in css
    libs = (VENDOR/'mermaid/mermaid.min.js').read_text(encoding='utf-8')+'\n' + '\n'.join((VENDOR/'highlight'/name).read_text(encoding='utf-8') for name in ['highlight.min.js','powershell.min.js','latex.min.js'])+'\n' + module('marked.mjs', ('Marked', 'B')) + module('purify.mjs', ('DOMPurify', 'purify')) + module('katex/katex.mjs', ('katex', 'katex'))
    parser = (ROOT / 'markdown-parser.mjs').read_text(encoding='utf-8').split('export function attachMarkdownPreview')[0]
    parser = re.sub(r'^import .*?;\s*', '', parser, flags=re.M)
    parser = parser.replace('export function', 'function')
    parser = parser.replace('src="${escape(imageUrl(href))}"', 'data-md-image-src="${escape(href)}"')
    # Authored HTML is sanitized before math layout HTML is inserted.
    script = libs + parser + '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in ['mermaid-surface.js', 'image-surface.js', 'format-surfaces.js', 'pdf-surface.js', 'viewer.js', 'file-icons.js', 'navigation.js', 'selection.js', 'outline.js', 'file-actions.js', 'edit-history.js', 'block-editor.js', 'toolbar.js', 'launcher.js', 'project-switcher.js', 'new-folder.js', 'selection-comments.js', 'comment-bubbles.js'])
    template = (ROOT / 'viewer-template.html').read_text(encoding='utf-8')
    html = template.replace('/* KATEX_CSS */', css).replace('/* VIEWER_SCRIPT */', script.replace('</script', '<\\/script'))
    (PLUGIN / 'viewer.html').write_text(html, encoding='utf-8')
    shutil.copy2(ROOT / 'server.py', PLUGIN / 'server.py')
    shutil.copy2(ROOT / 'VERSION', PLUGIN / 'VERSION')
    shutil.copy2(ROOT / 'image_reader.py', PLUGIN / 'image_reader.py')
    shutil.copy2(ROOT / 'directory_reader.py', PLUGIN / 'directory_reader.py')
    shutil.copy2(ROOT / 'file_reader.py', PLUGIN / 'file_reader.py')
    shutil.copy2(ROOT / 'file_writer.py', PLUGIN / 'file_writer.py')
    for name in ['access_policy.py', 'workspace_launcher.py', 'native_picker.py', 'project_context.py', 'csv_reader.py', 'pdf_reader.py', 'pdf_worker.py', 'directory_writer.py']:
        shutil.copy2(ROOT / name, PLUGIN / name)
    (PLUGIN / 'licenses').mkdir(exist_ok=True)
    for name in ['marked.LICENSE.md', 'dompurify.LICENSE', 'katex/LICENSE']:
        shutil.copy2(VENDOR / name, PLUGIN / 'licenses' / (name.replace('/', '-')))
    shutil.copy2(VENDOR/'highlight/LICENSE', PLUGIN/'licenses/highlightjs-LICENSE')
    shutil.copy2(VENDOR/'mermaid/LICENSE', PLUGIN/'licenses/mermaid-LICENSE')
    manifest = {'name':'markdown-math-preview','version':(ROOT/'VERSION').read_text(encoding='utf-8').strip(),'description':'Offline workspace for PDF reading, Markdown live editing, code highlighting, image zoom and CSV tables.',
        'author':{'name':'HuSiyue-ai'},'mcpServers':'./.mcp.json',
        'interface':{'displayName':'file-workspace','shortDescription':'PDF、Markdown、图片、代码与表格，共用一个文件树。',
        'developerName':'HuSiyue-ai','category':'Productivity','capabilities':['Read', 'Write']}}
    (PLUGIN / '.codex-plugin').mkdir(exist_ok=True)
    (PLUGIN / '.codex-plugin/plugin.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    # Local package: the source location is stable, and no shell expansion is required.
    mcp = {'mcpServers':{'markdown-math-preview':{'command':sys.executable,'args':['-B', str(PLUGIN / 'server.py')], 'env':{'PYTHONIOENCODING':'utf-8'}}}}
    mcp['mcpServers']['markdown-math-preview']['env'].update(env)
    (PLUGIN / '.mcp.json').write_text(json.dumps(mcp, ensure_ascii=False, indent=2), encoding='utf-8')
    marketplace = {'name':'markdown-preview-local','interface':{'displayName':'file-workspace-local'},'plugins':[{'name':'markdown-math-preview',
        'source':{'source':'local','path':'./plugins/markdown-math-preview'},'policy':{'installation':'AVAILABLE','authentication':'ON_INSTALL'},'category':'Productivity'}]}
    (ROOT / '.agents/plugins').mkdir(parents=True, exist_ok=True)
    (ROOT / '.agents/plugins/marketplace.json').write_text(json.dumps(marketplace, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'plugin':str(PLUGIN),'html_bytes':len(html.encode())},ensure_ascii=False))

if __name__ == '__main__':
    main()
