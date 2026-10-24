const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console,DOMPurify:{sanitize:s=>s},document:{getElementById:()=>({addEventListener(){}})}};vm.createContext(ctx);
for(const name of ['highlight.min.js','powershell.min.js','latex.min.js'])vm.runInContext(fs.readFileSync(__dirname+'/vendor/highlight/'+name,'utf8'),ctx);
vm.runInContext(fs.readFileSync(__dirname+'/format-surfaces.js','utf8'),ctx);const run=s=>vm.runInContext(s,ctx);
for(const [language,text] of [['python','def greet(name):\n    return "hello"\n'],['javascript','const n = 12;'],['powershell','$value = "text"'],['latex','\\frac{a}{b}'],['json','{"ok": true}']]){
 ctx.sample=text;ctx.language=language;const html=run('highlightedCode(sample,language)');assert.match(html,/hljs-/);
}
ctx.sample='<script>alert(1)</script>';assert.ok(!run("highlightedCode(sample,'xml')").includes('<script>'));
assert.equal(run("highlightedCode('text','unknown-language')"),null);
ctx.sample='x'.repeat(200001);assert.equal(run("highlightedCode(sample,'python')"),null,'large files remain plain text');
console.log('PASS: offline highlighter languages, escaped HTML, unsupported language fallback and large-source cutoff');
