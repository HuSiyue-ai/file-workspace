const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.children=[];this.events={};this.style={};this.hidden=false;this.disabled=false;this.isConnected=true;this.value='';this.attributes={};this.classList={toggle(){}};}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn);}setAttribute(k,v){this.attributes[k]=v;}
 append(child){child.parent=this;this.children.push(child);}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
 contains(target){return this===target||this.children.some(e=>e.contains(target));}
 focus(){document.activeElement=this;}select(){this.selected=true;}
 setSelectionRange(start,end){this.selectionRange=[start,end];}
 getBoundingClientRect(){return{left:420,bottom:290,width:208,height:220};}
 async emit(type,event={}){for(const fn of this.events[type]||[])await fn({type,preventDefault(){},stopPropagation(){},...event});}
}
const ids=['file-actions','file-copy-path','file-add-chat','file-new-folder','file-open-host','file-copy-name','file-copy-fallback','file-copy-value','file-action-name'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['file-actions'].hidden=true;
for(const id of ids.slice(1))elements['file-actions'].append(elements[id]);
const document=new Element();document.body=new Element();document.getElementById=id=>elements[id];document.createElement=()=>new Element();
let clipboard='',legacy=true,modernFailure=false,modernCalls=0,previewCancelled=0,opened=null,deferred=null,lastCopyInput=null,selectionCleanup=0;
document.getSelection=()=>({removeAllRanges:()=>selectionCleanup++});
document.execCommand=()=>{lastCopyInput=document.body.children.at(-1);if(legacy)clipboard=lastCopyInput.value;return legacy;};
const window=new Element();window.innerWidth=480;window.innerHeight=300;
const a={name:'中文 空格.md',path:'C:\\资料\\中文 空格.md',kind:'file',button:new Element()},b={name:'other.png',path:'C:\\资料\\other.png',kind:'file',button:new Element()};
const key=p=>p.toLowerCase(),nodes=new Map([[key(a.path),a],[key(b.path),b]]),messages=[],notices=[];
const context={document,window,navigator:{clipboard:{writeText:async text=>{modernCalls++;if(modernFailure)throw new Error('denied');clipboard=text;}}},viewerDisposed:false,selectionDraftAvailable:true,hostFileOpenAvailable:true,directoryNodes:nodes,pathKey:key,
 cancelPendingFilePreview:()=>previewCancelled++,resetSelectedExcerpt(){},setDirectoryMenuVisible(){},excerptNotice:(...args)=>notices.push(args),openDirectoryFile:async node=>opened=node.path,
 request:async(method,params)=>{messages.push({method,params});if(deferred)return deferred;return{};}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/file-actions.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
function show(node=a){context.showFileActions({type:'contextmenu',clientX:478,clientY:298,preventDefault(){},stopPropagation(){}},node);}
async function main(){
 show();assert.equal(messages.length,0);assert.equal(clipboard,'');assert.equal(previewCancelled,1);
 assert.equal(elements['file-actions'].style.left,'264px');assert.equal(elements['file-actions'].style.top,'72px');
 await elements['file-copy-path'].emit('click');assert.equal(clipboard,a.path);assert.equal(modernCalls,1);assert.equal(messages.length,0);assert.equal(document.body.children.length,0);
 show(b);await elements['file-copy-name'].emit('click');assert.equal(clipboard,b.name);
 modernFailure=true;show();await elements['file-copy-path'].emit('click');assert.equal(clipboard,a.path);assert.equal(elements['file-actions'].hidden,true,'legacy copy handles a blocked standard API');
 assert.deepEqual(lastCopyInput.selectionRange,[0,0]);assert.equal(selectionCleanup,1,'compatibility copy clears its temporary selection before removal');
 legacy=false;show();await elements['file-copy-path'].emit('click');assert.equal(elements['file-actions'].hidden,false);assert.equal(elements['file-copy-fallback'].hidden,false);assert.equal(elements['file-copy-value'].value,a.path);assert.equal(elements['file-copy-value'].selected,true);
 await elements['file-actions'].emit('keydown',{key:'Escape',target:elements['file-copy-value']});assert.equal(elements['file-actions'].hidden,true);
 let resolve;deferred=new Promise(r=>resolve=r);show(a);const adding=elements['file-add-chat'].emit('click');await elements['file-add-chat'].emit('click');
 assert.equal(messages.length,1);assert.equal(messages[0].method,'ui/message');const params=messages[0].params;
 assert.equal(params._meta['openai/message'].send,false);assert.equal(params._meta['openai/message'].target,'active');assert.equal(params.role,'user');
 assert.ok(params.content[0].text.includes(a.path));assert.ok(!params.content[0].text.includes(b.path));assert.equal(params.content.length,1,'only a path reference, never implicit file contents');
 resolve({});await adding;deferred=null;
 context.selectionDraftAvailable=false;show();assert.equal(elements['file-add-chat'].disabled,true);await context.performFileAction('chat');assert.equal(messages.length,1);
 context.selectionDraftAvailable=true;show(b);await elements['file-open-host'].emit('click');assert.equal(opened,b.path);
 show(a);nodes.delete(key(a.path));await context.performFileAction('chat');assert.equal(messages.length,1,'stale menu cannot act on removed entries');nodes.set(key(a.path),a);
 show();await elements['file-actions'].emit('keydown',{key:'End'});assert.equal(document.activeElement,elements['file-copy-name']);
 await elements['file-actions'].emit('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,elements['file-copy-path']);
 await document.emit('pointerdown',{target:document.body});assert.equal(elements['file-actions'].hidden,true);
 show();await window.emit('resize');assert.equal(elements['file-actions'].hidden,true);
 show();context.viewerDisposed=true;await window.emit('pagehide');assert.equal(elements['file-actions'].hidden,true);assert.equal(run('fileActionTarget'),null);
 console.log('PASS: context-only activation, exact clicked-file path/name, clipboard compatibility and honest manual fallback, draft-only targeted reference, duplicate/capability/stale guards, keyboard/viewport/outside/resize/teardown');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
