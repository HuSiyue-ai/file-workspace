const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.children=[];this.events={};this.attrs={};this.classes=new Set();this.classList={toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n),contains:n=>this.classes.has(n)};this.style={};this.options=['read','edit','source'].map(value=>({value}));}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}setAttribute(n,v){this.attrs[n]=v;}removeAttribute(n){delete this.attrs[n];}focus(){document.activeElement=this;}
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}querySelectorAll(){return[];}async emit(n,event={}){for(const f of this.events[n]||[])await f({preventDefault(){},...event});}
}
const elements=new Map(),document=new Element(),window=new Element(),storage=new Map(),calls=[],rendered=[];
document.getElementById=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const context={document,window,localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)},
 activeFile:{path:'C:\\notes\\a.md',kind:'markdown',revision:'a'.repeat(64)},sourceText:'# original',readGeneration:1,
 preview:document.getElementById('preview'),resetSelectedExcerpt(){},render(text){rendered.push(text);context.sourceText=text;},setTimeout,clearTimeout,
 request:async(method,params)=>{calls.push({method,params});return{structuredContent:{path:params.arguments.path,revision:'b'.repeat(64),saved:true,backupPath:'backup'}};}};
vm.createContext(context);for(const name of ['edit-history.js','block-editor.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+name,'utf8'),context);
const run=s=>vm.runInContext(s,context),el=id=>document.getElementById(id),tick=()=>new Promise(r=>setImmediate(r));
async function type(text){el('markdown-editor').value=text;await el('markdown-editor').emit('input');}
async function main(){
 await run("changeDocumentMode('source')");assert.equal(el('markdown-editor').value,'# original');assert.equal(calls.length,0);
 await type('# draft');assert.equal(run('editorDirty()'),true);assert.equal(storage.size,1);assert.equal(calls.length,0,'typing never saves');
 await run("changeDocumentMode('read')");assert.equal(rendered.at(-1),'# draft');assert.equal(context.sourceText,'# original','preview keeps disk baseline');assert.equal(run('editorDirty()'),true,'reading retains draft');assert.equal(el('editor-pane').hidden,true);
 const cancelled=run('confirmEditorNavigation()');await tick();run("finishEditorDecision('stay')");assert.equal(await cancelled,false);assert.equal(run('editorSession.text'),'# draft');
 const discarded=run('confirmEditorNavigation()');await tick();run("finishEditorDecision('discard')");assert.equal(await discarded,true);assert.equal(run('editorSession'),null);assert.equal(storage.size,0);assert.equal(context.sourceText,'# original');
 await run("changeDocumentMode('source')");await type('# saved');assert.equal(await run('saveEditor()'),true);assert.equal(calls.length,1);assert.equal(calls[0].params.name,'save_markdown_file');assert.equal(calls[0].params.arguments.revision,'a'.repeat(64));assert.equal(context.sourceText,'# saved');assert.equal(run('editorDirty()'),false);assert.equal(storage.size,0);
 await type('# conflict draft');context.request=async()=>({isError:true,content:[{type:'text',text:'文件已被其他程序修改'}]});assert.equal(await run('saveEditor()'),false);assert.equal(run('editorSession.text'),'# conflict draft');assert.equal(run('editorDirty()'),true);assert.match(el('edit-status').textContent,/其他程序修改/);assert.equal(storage.size,1);
 run('stopEditor()');await run("changeDocumentMode('source')");assert.equal(el('markdown-editor').value,'# conflict draft','draft restores after editor recreation');
 context.request=async(method,params)=>({structuredContent:{saved:true,path:params.arguments.path,revision:'c'.repeat(64)}});
 const savedSwitch=run('confirmEditorNavigation()');await tick();run("finishEditorDecision('save')");assert.equal(await savedSwitch,true);assert.equal(run('editorSession'),null);assert.equal(context.sourceText,'# conflict draft');assert.equal(storage.size,0);
 await run("changeDocumentMode('source')");await type('# shortcut');await document.emit('keydown',{ctrlKey:true,key:'s'});await tick();assert.equal(context.sourceText,'# shortcut');assert.equal(run('editorDirty()'),false);
 await type('# undo');await document.emit('keydown',{ctrlKey:true,key:'z'});assert.notEqual(run('editorSession.text'),'# undo');await document.emit('keydown',{ctrlKey:true,shiftKey:true,key:'z'});assert.equal(run('editorSession.text'),'# undo');
 console.log('PASS: shared source/read draft, locked reading controls, cancel/discard/save navigation, versioned saves, conflict retention, recovery and keyboard undo/redo/save');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
