// New-chat startup, delayed project context and manual-selection race regressions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function fixture(){
  const elements=new Map(),calls=[],timers=new Map(),roots=[];let timerId=0;
  function element(id){if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',style:{},classList:{toggle(){}},addEventListener(){},replaceChildren(){},scrollTo(){}});return elements.get(id);}
  const context={document:{getElementById:element},preview:element('preview'),status:element('status'),
    anchorFile:null,activeFile:null,viewerDisposed:false,workspaceSession:null,readGeneration:0,sourceText:'',
    setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    request:(method,params)=>new Promise((resolve,reject)=>calls.push({method,params,resolve,reject})),
    setDirectoryVisible(){},setWorkspaceRootChoices:choices=>{roots.splice(0,roots.length,...choices);},rememberWorkspaceRoot(){},
    cancelPendingFilePreview(){},stopEditor(){},resetSelectedExcerpt(){},clearOutline(){},clearFormatSurfaces(){},
    pictureSurface:{clear(){}},syncDocumentNavigation(){},loadWorkspaceRootChoices(){},editorNotice(){},
    confirmEditorNavigation:async()=>true};
  vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/launcher.js','utf8'),context);
  const run=code=>vm.runInContext(code,context),reply=(call,data)=>call.resolve({structuredContent:data});
  return {context,elements,calls,timers,roots,run,reply};
}
const project=(name='project')=>({directory:{name,path:'C:/'+name,kind:'directory',resourceUri:'selected:'+name},session:'token:'+name});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
  let f=fixture();let started=f.run('showLauncherHome()');
  assert.equal(f.calls[0].params.arguments.allowSelectedProject,true);
  f.reply(f.calls[0],{...project(),roots:[project(),project('second')]});await started;
  assert.equal(f.context.anchorFile.path,'C:/project');assert.equal(f.roots.length,2);assert.equal(f.timers.size,0);
  await f.run('retryWorkspaceHome()');assert.equal(f.calls.length,1,'loaded roots do not follow global project changes');

  f=fixture();started=f.run('showLauncherHome()');f.reply(f.calls[0],{needsDirectory:true,roots:[]});await started;
  assert.equal(f.timers.size,1);const timer=[...f.timers.entries()][0];f.timers.delete(timer[0]);timer[1].fn();await tick();
  assert.equal(f.calls[1].params.arguments.allowSelectedProject,false,'delayed queries do not bind to a different global project');
  f.reply(f.calls[1],project('late-project'));await tick();
  assert.equal(f.context.anchorFile.path,'C:/late-project');assert.equal(f.timers.size,0);

  f=fixture();started=f.run('showLauncherHome()');f.run('cancelWorkspaceHome()');
  f.reply(f.calls[0],project('stale-global'));await started;
  assert.equal(f.context.anchorFile,null);assert.equal(f.roots.length,0);assert.equal(f.timers.size,0,'cancelled startup cannot replace a manual choice');

  f=fixture();started=f.run('showLauncherHome()');f.context.anchorFile={resourceUri:'host:file',path:'C:/manual.md'};
  f.reply(f.calls[0],project('stale-global'));await started;assert.equal(f.context.anchorFile.path,'C:/manual.md');

  f=fixture();started=f.run('showLauncherHome()');f.context.viewerDisposed=true;f.run('cancelWorkspaceHome()');
  f.reply(f.calls[0],project('after-close'));await started;assert.equal(f.context.anchorFile,null);assert.equal(f.timers.size,0);

  f=fixture();started=f.run('showLauncherHome()');f.reply(f.calls[0],{needsDirectory:true});await started;
  for(let i=0;i<4;i++){
    const [id,timer]=[...f.timers.entries()][0];f.timers.delete(id);timer.fn();await tick();
    f.reply(f.calls.at(-1),{needsDirectory:true});await tick();
  }
  assert.equal(f.calls.length,5);assert.equal(f.timers.size,0,'startup polling is bounded');
  f.run('launcherConnected=true');const refreshed=f.run('retryWorkspaceHome()');
  assert.equal(f.calls.at(-1).params.arguments.allowSelectedProject,false,'manual refresh retries own context, not another window selection');
  f.reply(f.calls.at(-1),project('refreshed-project'));await refreshed;
  assert.equal(f.context.anchorFile.path,'C:/refreshed-project');
  console.log('PASS: new-chat roots, bounded delayed context, one-shot global fallback, manual/file/teardown races and explicit refresh');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
