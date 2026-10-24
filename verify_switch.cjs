// 验证跨文件异步结果不会串页，以及刷新、销毁和当前文档元数据。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.children=[];this.hidden=false;this.style={};this.textContent='';this.attributes={};this.events={};}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}
 replaceChildren(){}querySelectorAll(){return[];}
 setAttribute(n,v){this.attributes[n]=v;}getAttribute(n){return this.attributes[n];}
}
const ids=['preview','status','source','title','size','toggle','outline-toggle','picture-view','refresh'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const sent=[],shown=[],rendered=[],navigated=[],timers=new Map();let timerId=0,cleared=0,selectionCleared=0;
const parent={postMessage:value=>sent.push(value)},window={parent,events:{},addEventListener(n,f){(this.events[n]??=[]).push(f);},scrollTo(){}};
window.getSelection=()=>({removeAllRanges:()=>selectionCleared++});
const context={window,document:{createElement:()=>new Element(),getElementById:id=>elements[id],documentElement:{dataset:{}}},
 DOMPurify:{addHook(){},sanitize:s=>s},markdownHtml:text=>{rendered.push(text);return'';},
 pictureSurface:{clear:()=>++cleared,show:(data,name)=>shown.push({data,name})},
 resetSelectedExcerpt(){},clearOutline(){},rebuildOutline(){},cancelPendingFilePreview(){},setSelectionHostCapabilities(){},
 navigationMode:'files',setDirectoryVisible(){},syncDocumentNavigation:(file,preserve)=>navigated.push({file,preserve}),
 setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/viewer.js','utf8'),context);
const run=source=>vm.runInContext(source,context),tick=()=>new Promise(resolve=>setImmediate(resolve));
const reply=(request,result)=>{for(const callback of window.events.message)callback({source:parent,data:{jsonrpc:'2.0',id:request.id,result}});};
const snapshot=(name,kind='markdown')=>({path:'C:\\notes\\'+name,name,kind,text:'# '+name,mimeType:'image/png',blob:'AA=='});
async function main(){
 reply(sent[0],{hostCapabilities:{experimental:{'openai/files':{}}}});await tick();
 context.document.activeElement={tagName:'INPUT'};run('clearFileNavigationSelection()');assert.equal(selectionCleared,0,'typing in a filter/input keeps its selection');
 context.document.activeElement=null;run('clearFileNavigationSelection()');assert.equal(selectionCleared,1,'navigation clears stale document selection');
 run("workspaceSession='current-token'");
 const scoped=run("request('tools/call',{name:'list_markdown_directory',arguments:{workspaceSession:'chosen-root-token'}})");
 assert.equal(sent.at(-1).params.arguments.workspaceSession,'chosen-root-token','explicit project root token must not be overwritten by current file token');reply(sent.at(-1),{});await scoped;run('workspaceSession=null');
 const initial=run("loadFile({name:'入口.md',resourceUri:'host:entry'})");
 assert.equal(sent.at(-1).params.name,'read_preview_file');reply(sent.at(-1),{structuredContent:snapshot('入口.md')});await initial;
 assert.equal(elements.title.textContent,'入口.md');assert.equal(navigated.at(-1).preserve,false);
 const old=run("previewPath('C:\\\\notes\\\\old.md')"),oldRequest=sent.at(-1);
 const latest=run("previewPath('C:\\\\notes\\\\new.png')"),latestRequest=sent.at(-1);
 reply(latestRequest,{structuredContent:snapshot('new.png','image')});await latest;
 reply(oldRequest,{structuredContent:snapshot('old.md')});await old;
 assert.equal(elements.title.textContent,'new.png');assert.equal(shown.length,1);assert.equal(rendered.length,1);
 assert.equal(elements['picture-view'].hidden,false);assert.equal(elements['outline-toggle'].hidden,true);
 const refresh=run('previewPath(activeFile.path)');assert.equal(sent.at(-1).params.arguments.path,'C:\\notes\\new.png');
 reply(sent.at(-1),{structuredContent:snapshot('new.png','image')});await refresh;
 const text=run("previewPath('C:\\\\notes\\\\说明.txt')");reply(sent.at(-1),{structuredContent:snapshot('说明.txt','text')});await text;
 assert.equal(elements.source.hidden,false);assert.equal(elements['picture-view'].hidden,true);assert.equal(elements.source.textContent,'# 说明.txt');
 const failure=run("previewPath('C:\\\\notes\\\\a.pdf')");reply(sent.at(-1),{isError:true,content:[{type:'text',text:'此格式暂不能在本页预览'}]});await failure;
 assert.match(elements.status.textContent,/此格式/);assert.equal(elements.source.hidden,true);
 const recovered=run("previewPath('C:\\\\notes\\\\第二篇.md')");reply(sent.at(-1),{structuredContent:snapshot('第二篇.md')});await recovered;
 assert.equal(elements.preview.hidden,false);assert.equal(elements['outline-toggle'].hidden,false);assert.equal(elements.title.textContent,'第二篇.md');
 assert.equal(navigated.at(-1).preserve,true);assert.match(run('activeFile.resourceUri'),/#preview=/);
 const pending=run("previewPath('C:\\\\notes\\\\pending.md')");run('teardownViewer()');await pending;
 assert.equal(timers.size,0);assert.equal(run('viewerDisposed'),true);const total=sent.length;
 await run("previewPath('C:\\\\notes\\\\after.md')");assert.equal(sent.length,total);assert.ok(cleared>=7);
 assert.equal(sent.filter(request=>request.method==='openai/files/open').length,0,'preview reads never open native tabs');
 console.log('PASS: out-of-order file switching, image/text/Markdown visibility, current-path refresh, error recovery, scoped selection identity, teardown and no native-tab side effects');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
