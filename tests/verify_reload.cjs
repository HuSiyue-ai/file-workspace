const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(){
 const elements=new Map(),calls=[],writes=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,title:'reload',textContent:'',classList:{toggle(){}},addEventListener(){},remove(){},scrollTop:140});return elements.get(id);};
 const context={document:{body:{inert:false},getElementById:el,querySelector:()=>({content:'1.11.0'}),open(){writes.push('open');},write(value){writes.push(value);},close(){writes.push('close');}},
  window:{dispatchEvent(){context.viewerDisposed=true;}},Event:class{},workspaceResume:null,viewerDisposed:false,
  launcherBusy:false,rootSwitchBusy:false,excerptCommentsBusy:false,selectionBusy:false,folderCreateBusy:false,editorSession:null,quickCommentDraft:null,displayMode:'edit',
  confirmEditorNavigation:async()=>true,unwrapWorkspace:result=>result.structuredContent,
  request:async(method,params)=>{calls.push(params);return {structuredContent:{html:'<html><head>workspace-version</head><body><button id="plugin-reload">Reload</button></body></html>'}};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../src/viewer/plugin-reload.js','utf8'),context);
 vm.runInContext('captureWorkspaceReload=()=>({schema:1,comments:[{text:"</script><script>untrusted"}]})',context);
 return {context,calls,writes,el,run:code=>vm.runInContext(code,context)};
}
async function main(){
 let test=setup();await test.run('reloadWorkspacePlugin()');assert.equal(test.calls.length,1);assert.equal(test.writes.length,3);
 assert(test.writes[1].includes('id="workspace-resume"'));assert(test.writes[1].includes('\\u003c/script>'));assert(!test.writes[1].includes('</script><script>untrusted'));
 test=setup();test.context.confirmEditorNavigation=async()=>false;await test.run('reloadWorkspacePlugin()');assert.equal(test.writes.length,0);assert(!test.el('plugin-reload').disabled);
 test=setup();test.context.request=async()=>({structuredContent:{restartRequired:true,uiVersion:'2'}});await test.run('reloadWorkspacePlugin()');assert.equal(test.writes.length,0);assert.match(test.el('plugin-update-status').textContent,/重新建立插件连接/);
 test=setup();test.context.request=async()=>{throw Error('service unavailable');};await test.run('reloadWorkspacePlugin()');assert.equal(test.writes.length,0);assert.match(test.el('plugin-update-status').textContent,/当前页面已保留/);
 test=setup();
 const html='<html><head>workspace-version</head><body><button id="plugin-reload">Reload</button></body></html>';
 test.context.document.body={inert:false};
 test.context.request=async(method,params)=>{
   test.calls.push(params);
   if(params.arguments.apply){
     assert(test.context.document.body.inert);
     return {structuredContent:{html,backendReloaded:true}};
   }
   return {structuredContent:{backendUpdateAvailable:true}};
 };
 await test.run('reloadWorkspacePlugin()');
 assert.deepEqual(test.calls.map(p=>!!p.arguments.apply),[false,true]);
 assert(test.writes[1].includes('"backendReloaded":true'));
 assert(!test.context.document.body.inert);
 test=setup();
 test.context.request=async(method,params)=>{
   test.calls.push(params);
   if(params.arguments.apply)throw Error('新版后台启动失败');
   return {structuredContent:{backendUpdateAvailable:true}};
 };
 await test.run('reloadWorkspacePlugin()');
 assert.equal(test.writes.length,0);
 assert.match(test.el('plugin-update-status').textContent,/新版后台启动失败/);
 test.context.confirmEditorNavigation=async()=>false;test.calls.length=0;
 await test.run('reloadWorkspacePlugin()');
 assert.deepEqual(test.calls.map(p=>!!p.arguments.apply),[false],'cancelled edit never switches the backend');
 test=setup();test.context.folderCreateBusy=true;await test.run('reloadWorkspacePlugin()');assert.equal(test.calls.length,0);
 test=setup();test.context.quickCommentDraft={};test.context.confirmQuickExcerptComment=()=>false;await test.run('reloadWorkspacePlugin()');assert.equal(test.writes.length,0);
 test=setup();test.context.request=async()=>{test.context.viewerDisposed=true;return {structuredContent:{}};};await test.run('reloadWorkspacePlugin()');assert.equal(test.writes.length,0);
 test=setup();
 const {context}=test,states=[];
 Object.assign(context,{anchorFile:null,activeFile:null,workspaceSession:null,nextId:0,readGeneration:0,directoryRoot:null,
   directoryNodes:new Map(),cancelWorkspaceHome(){},setWorkspaceRootChoices(){},rebuildProjectRootMenu(){},
   setDirectoryVisible(){},showEmptyWorkspace(){},renderDirectory(){},preview:{style:{}},renderExcerptComments(){},
   excerptComments:[],excerptCommentNext:0,scheduleExcerptMarkers(){},requestAnimationFrame(){},theme(){},
   directoryList:{scrollTop:0},loadDirectory:async path=>{states.push(path);return false;}});
 const restore=async()=>{
   test.run("pluginResumeState={schema:1,anchorFile:{kind:'directory',path:'C:/project'},workspaceSession:'stale',directory:{visible:true,mode:'files'}}");
   await test.run('resumeReloadedWorkspace()');
 };
 await restore();
 assert.deepEqual(states,[undefined],'retry the default root after an earlier reload left the tree empty');
 assert.match(test.el('plugin-update-status').textContent,/文件树未能完整恢复/);
 context.loadDirectory=async()=>true;
 await restore();
 assert.match(test.el('plugin-update-status').textContent,/已在当前标签重载/);
 console.log('PASS: same-tab reload, escaped resume data, unsaved cancellation, backend mismatch, failed/late replies and in-flight write guards');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
