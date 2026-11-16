const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
  constructor(){this.children=[];this.handlers={};this.open=false;this.hidden=false;this.textContent='';}
  addEventListener(type,callback){this.handlers[type]=callback;}
  append(...children){for(const child of children)child.parent=this;this.children.push(...children);}
  replaceChildren(){this.children=[];}
  remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
  focus(){focused=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  setAttribute(){}
  querySelectorAll(){return this.children.map(row=>row.children[1]);}
}
let focused,mode='',dirty=false,recycled=false,restored=false,refreshed=0;
const path='/project/新建.md',parent='/project';
const file={kind:'file',name:'新建.md',path},folder={kind:'directory',name:'project',path:parent,loaded:true};
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const requests=[];
const context={
  document:{getElementById:get,createElement:()=>new Element()},
  workspaceSession:'session',workspaceRemoteHost:()=>mode,viewerDisposed:false,
  editorSession:{path},editorDirty:()=>dirty,pathKey:path=>path||'',activeFile:{path},anchorFile:{path},sourceText:'text',
  loadingPreviewPath:null,directoryData:{documentPath:path},directoryNodes:new Map([[parent,folder]]),readGeneration:0,
  stopEditor(){},resetSelectedExcerpt(){},clearOutline(){},pictureSurface:{clear(){}},clearFormatSurfaces(){},
  preview:new Element(),markDirectoryCurrent(){},showEmptyWorkspace(){context.empty=true;},directoryNotice(){},setDirectoryMenuVisible(){},
  loadDirectoryNode:async node=>{assert.equal(node,folder);refreshed++;},
  unwrapWorkspace:result=>result,
  request:async(method,{name,arguments:args})=>{
    assert.equal(method,'tools/call');assert.equal(name,'recycle_workspace_file');
    requests.push(args);
    if(args.action==='inspect')return {revision:'revision'};
    if(args.action==='delete'){assert.equal(args.revision,'revision');recycled=true;return {deleted:true,parent,workspace:{session:'new',directory:{path:parent}}};}
    if(args.action==='list')return {entries:[{id:'id',path,name:file.name}]};
    if(args.action==='restore'){if(!restored){restored=true;throw new Error('原位置已有同名文件');}return {restored:true,parent};}
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/file-recycle.js','utf8'),context);
const dialog=get('file-recycle-dialog'),confirm=get('file-recycle-confirm'),cancel=get('file-recycle-cancel'),status=get('file-recycle-status');
(async()=>{
  await context.showDeleteFile(folder);
  assert.equal(dialog.open,false);
  dirty=true;
  await context.showDeleteFile(file);
  assert.match(status.textContent,/未保存/);
  assert.equal(confirm.hidden,true);
  assert.equal(requests.length,0);
  cancel.handlers.click();
  dirty=false;
  await context.showDeleteFile(file);
  assert.equal(dialog.open,true);
  assert.equal(focused,cancel);
  assert.equal(get('file-recycle-path').textContent,path);
  assert.equal(confirm.hidden,false);
  cancel.handlers.click();
  assert.equal(recycled,false);
  await context.showDeleteFile(file);
  await confirm.onclick();
  assert.equal(recycled,true);
  assert.equal(dialog.open,false);
  assert.equal(context.workspaceSession,'new');
  assert.equal(context.anchorFile.path,parent);
  assert.equal(context.activeFile,null);
  assert.equal(context.empty,true);
  assert.equal(refreshed,1);
  mode='test-ssh';
  await context.showRecycleList();
  const list=get('file-recycle-list'),button=list.children[0].children[1];
  await button.handlers.click();
  assert.match(status.textContent,/同名/);
  assert.equal(list.children.length,1);
  await button.handlers.click();
  assert.equal(list.children.length,0);
  assert.equal(refreshed,2);
  assert.equal(requests.at(-1).workspaceSession,'new');
  console.log('PASS: cancel defaults, dirty editor protection, versioned delete, current preview reset, session continuity, remote restore conflict and retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
