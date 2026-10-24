// 使用实际导航模块验证：按需展开、并列目录、异步取消、定位、过滤和宽度记忆。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.isConnected=true;this.classes=new Set();this.classList={toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n)};}
 setAttribute(n,v){this.attributes[n]=v;}getAttribute(n){return this.attributes[n];}removeAttribute(n){delete this.attributes[n];}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}focus(options){this.focused=options||true;document.activeElement=this;}scrollIntoView(options){this.scrolled=options;}
 contains(target){return this===target||this.children.some(child=>child.contains?.(target));}
 setPointerCapture(id){this.captured=id;}hasPointerCapture(id){return this.captured===id;}releasePointerCapture(id){this.captured=null;}
 async emit(n,e={}){for(const f of this.events[n]||[])await f({preventDefault(){},stopPropagation(){},...e});await new Promise(resolve=>setImmediate(resolve));}
}
const root='C:\\notes',alpha=root+'\\alpha',beta=root+'\\beta',deep=alpha+'\\deep';
const file=(path)=>({path,name:path.split('\\').at(-1),kind:'file'}),folder=path=>({...file(path),kind:'directory'});
const data=(directory,entries,parent=root)=>({directory,entries,parent,documentPath:root+'\\entry.md',truncated:false});
const fixtures=new Map([[root,data(root,[folder(alpha),folder(beta),file(root+'\\entry.md'),file(root+'\\picture.png')],'C:\\')],
 [alpha,data(alpha,[folder(deep),file(alpha+'\\child.md')])],[deep,data(deep,[file(deep+'\\leaf.md')],alpha)],
 [beta,data(beta,[file(beta+'\\beta.md')])]]);
const ids=['directory-panel','directory-toggle','directory-list','directory-message','directory-path','directory-root-name','directory-up-quick','directory-up','directory-close','directory-home','directory-refresh','directory-collapse','directory-filter','directory-resize','outline-toggle','directory-view','outline-view','navigation-heading','directory-more','directory-menu','directory-tools'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['directory-panel'].hidden=true;
elements['directory-menu'].hidden=true;elements['directory-menu'].append(...['directory-up','directory-refresh','directory-collapse'].map(id=>elements[id]));
const document=new Element();document.body=new Element();document.getElementById=id=>elements[id];document.createElement=tag=>new Element(tag);document.documentElement={style:{setProperty(n,v){this[n]=v;}}};
const window=new Element();window.innerWidth=1000;
const calls=[],previews=[],timers=new Map(),deferred=new Map();let timerId=0;
const context={document,window,activeFile:{name:'entry.md',path:root+'\\entry.md',resourceUri:'resource:entry'},hostFileOpenAvailable:true,
 setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),previewPath:path=>previews.push(path),
 request:async(method,params)=>{calls.push({method,params});if(method==='openai/files/open')return{};const path=params.arguments.directory||root;
   if(deferred.has(path))return deferred.get(path);const fixture=fixtures.get(path);if(!fixture)throw new Error('fixture missing');return{structuredContent:fixture};}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/navigation.js','utf8'),context);
const run=s=>vm.runInContext(s,context),node=path=>run('directoryNodes.get('+JSON.stringify(path.toLowerCase().replace(/\\/g,'/'))+')');
const flush=async()=>{const list=[...timers.values()];timers.clear();for(const fn of list)await fn();await new Promise(resolve=>setImmediate(resolve));};
const reads=path=>calls.filter(call=>call.method==='tools/call'&&call.params.arguments.directory===path).length;
async function main(){
 context.syncDocumentNavigation(context.activeFile);assert.equal(calls.length,0);
 await elements['directory-toggle'].emit('click');assert.equal(calls.length,1);assert.equal(elements['directory-root-name'].textContent,'notes');
 assert.equal(elements['navigation-heading'].hidden,true);assert.equal(elements['directory-path'].hidden,false);
 const more=elements['directory-more'],menu=elements['directory-menu'];
 await more.emit('click');assert.equal(menu.hidden,false);assert.equal(document.activeElement,elements['directory-up']);
 await menu.emit('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,elements['directory-collapse']);
 await menu.emit('keydown',{key:'End'});assert.equal(document.activeElement,elements['directory-collapse']);
 await menu.emit('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,elements['directory-up'],'menu wraps keyboard focus');
 let escaped=false;await menu.emit('keydown',{key:'Escape',stopPropagation(){escaped=true;}});
 assert.equal(menu.hidden,true);assert.equal(elements['directory-panel'].hidden,false);assert.equal(escaped,true);assert.equal(document.activeElement,more);
 elements['directory-up'].disabled=true;await more.emit('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,elements['directory-collapse'],'disabled parent item is skipped');
 await document.emit('pointerdown',{target:elements['directory-filter']});assert.equal(menu.hidden,true);
 elements['directory-up'].disabled=false;await more.emit('click');await document.emit('focusin',{target:elements['directory-filter']});assert.equal(menu.hidden,true);
 await more.emit('click');await window.emit('blur');assert.equal(menu.hidden,true);
 assert.equal(run('directoryRoot.children.length'),4);assert.equal(reads(alpha),0,'collapsed folders must not be read recursively');
 await node(alpha).button.emit('click',{detail:1});assert.equal(node(alpha).expanded,false);assert.equal(reads(alpha),0,'defer a mouse single click until double-click detection completes');await flush();assert.equal(node(alpha).expanded,true);assert.equal(reads(alpha),1);
 assert.equal(run('directoryRoot.children.length'),4,'expanding a folder preserves siblings and root');
 let resolveBeta;deferred.set(beta,new Promise(resolve=>resolveBeta=resolve));
 const opening=context.setFolderExpanded(node(beta),true);const duplicate=context.setFolderExpanded(node(beta),true);
 assert.equal(reads(beta),1,'coalesce duplicate expansion requests');
 await context.setFolderExpanded(node(beta),false);resolveBeta({structuredContent:fixtures.get(beta)});await opening;await duplicate;deferred.delete(beta);
 assert.equal(node(beta).loaded,true);assert.equal(node(beta).expanded,false);assert.equal(node(beta).group.hidden,true,'late folder response must not reopen it');
 await context.setFolderExpanded(node(beta),true);assert.equal(reads(beta),1,'reopening uses the cached layer');
 assert.equal(node(alpha).expanded,true,'multiple folders stay expanded');
 await context.setFolderExpanded(node(deep),true);assert.equal(reads(deep),1);
 const fileNode=node(deep+'\\leaf.md');await fileNode.button.emit('click',{detail:1});await flush();assert.equal(previews.at(-1),deep+'\\leaf.md');
 assert.equal(calls.filter(call=>call.method==='openai/files/open').length,0);
 await fileNode.button.emit('click',{detail:1});await fileNode.button.emit('click',{detail:2});await fileNode.button.emit('dblclick');await flush();
 assert.equal(previews.length,1);assert.equal(calls.filter(call=>call.method==='openai/files/open').length,1);
 const preserved=fileNode.button;elements['directory-list'].scrollTop=123;
 context.activeFile={name:'leaf.md',path:deep+'\\leaf.md',resourceUri:'internal:leaf'};context.syncDocumentNavigation(context.activeFile,true);
 assert.equal(node(deep+'\\leaf.md').button,preserved);assert.equal(preserved.attributes['aria-current'],'page');assert.equal(elements['directory-list'].scrollTop,123);
 await elements['directory-collapse'].emit('click');assert.equal(node(alpha).expanded,false);
 elements['directory-filter'].value='leaf';await elements['directory-filter'].emit('input');assert.equal(node(alpha).element.hidden,false);assert.equal(node(beta).element.hidden,true);
 assert.equal(node(alpha).group.hidden,false);assert.equal(node(alpha).expanded,false,'filter expands matches without changing saved expansion state');
 elements['directory-filter'].value='';await elements['directory-filter'].emit('input');assert.equal(node(alpha).group.hidden,true);
 await elements['directory-home'].emit('click');assert.equal(node(alpha).expanded,true);assert.equal(node(deep).expanded,true);assert.equal(preserved.scrolled.block,'nearest');
 const resize=elements['directory-resize'],pointer=(x,id=1)=>({clientX:x,pointerId:id,button:0});
 await resize.emit('pointerdown',pointer(700));await resize.emit('pointermove',pointer(580));assert.equal(resize.attributes['aria-valuenow'],'420');
 await resize.emit('pointercancel',pointer(580));assert.equal(resize.captured,null);
 window.innerWidth=480;await window.emit('resize');assert.equal(resize.attributes['aria-valuenow'],'312','narrow layout reserves 168 px for the document');
 window.innerWidth=1000;await window.emit('resize');assert.equal(resize.attributes['aria-valuenow'],'420','restores requested width after the window grows');
 await elements['directory-close'].emit('click');await elements['directory-toggle'].emit('click');assert.equal(resize.attributes['aria-valuenow'],'420');assert.equal(node(alpha).expanded,true);
 fixtures.set(root,data(root,[folder(alpha),file(root+'\\entry.md')],'C:\\'));await elements['directory-refresh'].emit('click');
 assert.equal(node(beta),undefined,'refresh discards removed subtrees');assert.equal(node(alpha).expanded,true);assert.equal(node(deep).expanded,true);
 await context.loadDirectory(root);
 context.activeFile={name:'outside.md',path:'C:\\outside\\outside.md',resourceUri:'resource:outside'};
 const alphaReads=reads(alpha),previousPreviewCount=previews.length,previousOpenCount=calls.filter(c=>c.method==='openai/files/open').length;
 const alphaButton=node(alpha).button;
 await alphaButton.emit('click',{detail:1});await alphaButton.emit('click',{detail:2});await alphaButton.emit('dblclick');await flush();
 assert.equal(run('directoryRoot.path'),alpha);assert.equal(reads(alpha),alphaReads+1,'double-click opens one directory layer without an intermediate expansion request');
 assert.equal(previews.length,previousPreviewCount);assert.equal(calls.filter(c=>c.method==='openai/files/open').length,previousOpenCount,'folder entry never opens a native tab');
 assert.equal(context.activeFile.path,'C:\\outside\\outside.md','folder entry leaves the document unchanged');
 await node(deep).button.emit('dblclick');assert.equal(run('directoryRoot.path'),deep);
 await elements['directory-up'].emit('click');assert.equal(run('directoryRoot.path'),alpha,'up returns the actual parent, even when the document is elsewhere');
 await elements['directory-up'].emit('click');assert.equal(run('directoryRoot.path'),root);assert.ok(node(alpha).button.scrolled,'returning up reveals the folder that was left');
 await node(alpha).button.emit('click',{detail:0});assert.equal(node(alpha).expanded,true,'keyboard activation remains immediate');
 const retainedRoot=run('directoryRoot');elements['directory-list'].scrollTop=77;
 assert.equal(await context.loadDirectory('missing-folder'),false);assert.equal(run('directoryRoot'),retainedRoot,'failed folder entry keeps the old tree');assert.equal(elements['directory-list'].scrollTop,77);
 let oldResolve;deferred.set('slow',new Promise(resolve=>oldResolve=resolve));fixtures.set('fast',data('C:\\fast',[],'C:\\'));
 const old=context.loadDirectory('slow');assert.equal(run('directoryRoot'),retainedRoot,'loading a new root keeps the existing tree until success');await context.loadDirectory('fast');oldResolve({structuredContent:fixtures.get(root)});await old;
 assert.equal(run('directoryRoot.path'),'C:\\fast','stale root result must not replace the latest tree');
 context.disposeDirectoryTree();assert.equal(run('directoryNodes.size'),0);assert.equal(timers.size,0);
 const html=fs.readFileSync(__dirname+'/plugins/markdown-math-preview/viewer.html','utf8');new vm.Script(html.split('<script>')[1].split('</script>')[0]);
 assert.match(html,/id="workspace"/);assert.match(html,/#workspace\{display:flex/);assert.match(html,/id="directory-list" role="tree"/);
 const template=fs.readFileSync(__dirname+'/viewer-template.html','utf8');
 assert.equal(/margin-right:|position:fixed;top:48px|\.directory-open \.document-area/.test(template),false,'layout must use a real split, without overlay or margin workaround');
 console.log('PASS: delayed single-click expansion, double-click folder entry without intermediate reads/native tabs/document changes, actual-parent navigation, atomic failure recovery, stale roots, compact menus, lazy tree, filter/locate, width constraints, teardown and bundled syntax');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
