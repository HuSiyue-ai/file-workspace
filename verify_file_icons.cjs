const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent='';this.classList={add:(...names)=>this.classes.push(...names)};this.classes=[];}
 setAttribute(k,v){this.attrs[k]=v;}append(el){this.children.push(el);}
}
const ctx={document:{createElementNS:(ns,tag)=>new Element(tag)}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/file-icons.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
for(const [name,kind] of Object.entries({'README.MD':'markdown','plot.PNG':'image','paper.pdf':'pdf','report.docx':'word','table.xlsx':'sheet','slides.pptx':'slides','data.csv':'sheet','viewer.js':'javascript','index.ts':'typescript','script.py':'python','notebook.ipynb':'notebook','data.json':'json','settings.toml':'config','archive.tar.gz':'archive','movie.mp4':'video','audio.flac':'audio','unknown.qzy':'text'})){
 assert.equal(run(`describeFileIcon(${JSON.stringify(name)}).kind`),kind);
 const el=new Element('span');ctx.targetIcon=el;ctx.entry={name,kind:'file'};run('decorateDirectoryFileIcon(targetIcon,entry)');
 assert.equal(el.attrs['data-file-icon'],kind);assert.equal(el.children[0].tag,'svg');assert.equal(el.children[0].attrs.width,'18');
}
assert.equal(run("describeFileIcon('folder.md','directory').kind"),'folder');
ctx.entry={name:'<img src="https://example.test/a">.png',kind:'file'};ctx.targetIcon=new Element('span');run('decorateDirectoryFileIcon(targetIcon,entry)');
const flatten=node=>[node,...node.children.flatMap(flatten)],nodes=flatten(ctx.targetIcon);
assert.ok(nodes.every(node=>['span','svg','path','rect','circle','ellipse','text'].includes(node.tag)));
assert.ok(nodes.every(node=>!('href'in node.attrs)&&!('src'in node.attrs)));
console.log('PASS: file type classification, case-insensitive multi-extension names, folder preservation, fixed SVG size and no HTML/network injection');
