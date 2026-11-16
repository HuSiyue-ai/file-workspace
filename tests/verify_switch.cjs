// 验证跨文件异步结果不会串页，以及刷新、销毁和当前文档元数据。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.children=[];this.hidden=false;this.style={};this.textContent='';this.attributes={};this.events={};this.scrollTop=0;this.dataset={};}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}
 replaceChildren(...children){this.children=children;}querySelectorAll(){return[];}
 scrollTo({top}){this.scrollTop=top;}
 getBoundingClientRect(){return {top:20,bottom:200};}
 setAttribute(n,v){this.attributes[n]=v;}getAttribute(n){return this.attributes[n];}
}
const ids=['preview','status','source','title','size','toggle','outline-toggle','picture-view','refresh','document-area'];
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
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../src/viewer/viewer.js','utf8'),context);
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

 const area=elements['document-area'];
 const block=(markup,top,height)=>({
   innerHTML:markup,previewMarkup:markup,dataset:{},
   getBoundingClientRect:()=>({top:20+top-area.scrollTop,bottom:20+top+height-area.scrollTop})
 });
 let nextBlocks=[];
 context.document.createElement=()=>Object.assign(new Element(),{children:nextBlocks});
 const clickRefresh=()=>elements.refresh.events.click[0]();
 const currentDoc=snapshot('第二篇.md');
 elements.preview.children=[block('intro',0,500),block('target',500,70),block('following',570,100)];
 area.scrollTop=526;
 clickRefresh();
 assert.equal(sent.at(-1).params.arguments.path,currentDoc.path);
 assert.equal(elements.preview.hidden,false,'retain the current preview while waiting for the reread');
 assert.equal(area.scrollTop,526);
 nextBlocks=[block('inserted',0,220),block('intro',220,500),block('target',720,70),block('following',790,100)];
 reply(sent.at(-1),{structuredContent:{...currentDoc,text:'# updated'}});
 await tick();
 assert.equal(area.scrollTop,746,'inserting material above keeps the target paragraph and its offset');
 assert.equal(elements.source.textContent,'# updated');

 clickRefresh();
 area.scrollTop=750;
 nextBlocks=[block('new intro',0,720),block('rewritten target',720,130),block('following',850,100)];
 reply(sent.at(-1),{structuredContent:currentDoc});await tick();
 assert.equal(area.scrollTop,810,'use the nearby unchanged visible block if the current paragraph was rewritten');

 clickRefresh();
 nextBlocks=[block('all text replaced',0,1000)];
 reply(sent.at(-1),{structuredContent:currentDoc});await tick();
 assert.equal(area.scrollTop,810,'fall back to the previous scroll offset if no visible block survives');
 clickRefresh();
 reply(sent.at(-1),{isError:true,content:[{type:'text',text:'暂时无法读取'}]});await tick();
 assert.equal(elements.preview.hidden,false,'a failed refresh keeps the last preview');
 assert.equal(area.scrollTop,810);
 assert.match(elements.status.textContent,/暂时无法读取/);
 const switchFile=run("previewPath('different.md')");
 reply(sent.at(-1),{structuredContent:snapshot('different.md')});await switchFile;
 assert.equal(area.scrollTop,0,'changing files still opens at the top');

 let revealed=0;
 context.adoptLinkedWorkspace=data=>{context.linked=data;run("workspaceSession="+JSON.stringify(data.session)+";anchorFile="+JSON.stringify(data.directory));};
 context.revealLinkedFile=async()=>{revealed++;};
 const linked=run("loadFile({name:'remote.md',resourceUri:'host:remote'})");
 reply(sent.at(-1),{structuredContent:{path:'/shared/remote.md',name:'remote.md',kind:'markdown',text:'# remote',host:'lab',workspace:{directory:{path:'/shared',host:'lab',resourceUri:'ssh:root',kind:'directory'},session:'remote-token'}}});await linked;
 assert.equal(run('workspaceSession'),'remote-token');assert.equal(run('activeFile.host'),'lab');assert.equal(revealed,1);
 const embedded=run("request('tools/call',{name:'read_markdown_images',arguments:{sources:['image.png']}})");assert.equal(sent.at(-1).params.arguments.workspaceSession,'remote-token');reply(sent.at(-1),{});await embedded;
 const late=run("previewPath('/shared/old.md')"),lateRequest=sent.at(-1),newer=run("previewPath('/shared/new.md')");
 reply(sent.at(-1),{structuredContent:{path:'/shared/new.md',name:'new.md',kind:'markdown',text:'# newer'}});await newer;
 const beforeIdentity=run('anchorFile.resourceUri');reply(lateRequest,{structuredContent:{path:'/shared/old.md',kind:'markdown',workspace:{directory:{host:'wrong',resourceUri:'wrong'},session:'wrong'}}});await late;
 assert.equal(run('workspaceSession'),'remote-token');assert.equal(run('anchorFile.resourceUri'),beforeIdentity,'late replies must not replace transport identity');
 const pending=run("previewPath('C:\\\\notes\\\\pending.md')");run('teardownViewer()');await pending;
 assert.equal(timers.size,0);assert.equal(run('viewerDisposed'),true);const total=sent.length;
 await run("previewPath('C:\\\\notes\\\\after.md')");assert.equal(sent.length,total);assert.ok(cleared>=7);
 assert.equal(sent.filter(request=>request.method==='openai/files/open').length,0,'preview reads never open native tabs');
 console.log('PASS: out-of-order file switching, image/text/Markdown visibility, current-path refresh, error recovery, scoped selection identity, teardown and no native-tab side effects');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
