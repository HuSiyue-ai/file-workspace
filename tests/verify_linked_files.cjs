const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function fixture(){
 const elements=new Map(),roots=[],locates=[],shows=[],remembered=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,classList:{toggle(){}},addEventListener(){}});return elements.get(id);};
 let finish;
 const context={document:{getElementById:get},preview:{},status:{},viewerDisposed:false,anchorFile:{kind:'directory',path:'/shared',host:'lab'},workspaceSession:'remote',readGeneration:4,
 activeFile:{path:'/shared/nested/remote.md',host:'lab'},directoryPanel:get('panel'),
 cancelWorkspaceHome(){},rememberWorkspaceRoot:data=>remembered.push(data),
 setDirectoryVisible:(...args)=>shows.push(args),pathKey:p=>p.toLowerCase(),
 loadDirectory:path=>{roots.push(path);return new Promise(resolve=>finish=resolve);},locateCurrentFile:async options=>locates.push(options),
 cancelPendingFilePreview(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../src/viewer/launcher.js','utf8'),context);
 const run=source=>vm.runInContext(source,context);
 return{context,run,roots,locates,shows,remembered,finish:result=>finish(result)};
}
async function main(){
 let f=fixture();const original=f.context.activeFile;
 f.context.choice={directory:{path:'/shared',host:'lab',resourceUri:'ssh:root'},session:'capability'};
 f.run('adoptLinkedWorkspace(choice)');assert.equal(f.context.workspaceSession,'capability');assert.equal(f.context.activeFile,original,'adoption does not erase the preview');assert.equal(f.context.readGeneration,4);
 let result=f.run('revealLinkedFile()');assert.deepEqual(f.roots,['/shared']);assert.deepEqual(f.shows,[[true,'files',false]]);f.finish(true);await result;assert.equal(f.locates.length,1);assert.equal(f.locates[0].focus,false,'automatic locate does not steal editor focus');
 f=fixture();result=f.run('revealLinkedFile()');f.context.activeFile={path:'/shared/new.md'};f.finish(true);await result;assert.equal(f.locates.length,0,'old reveal cannot locate after file switch');
 f=fixture();result=f.run('revealLinkedFile()');f.context.directoryPanel.hidden=true;f.finish(true);await result;assert.equal(f.locates.length,0,'closing the tree cancels automatic locate');
 f=fixture();result=f.run('revealLinkedFile()');f.finish(false);await result;assert.equal(f.locates.length,0,'tree errors retain readable document');assert.equal(f.shows.length,1,'failed loads do not trigger a duplicate request');
 f=fixture();f.context.anchorFile={resourceUri:'host:local'};f.context.activeFile={path:'C:/notes/local.md'};f.context.workspaceSession=null;
 result=f.run('revealLinkedFile()');assert.deepEqual(f.roots,['C:/notes']);f.finish(true);await result;assert.equal(f.locates.length,1);
 f=fixture();result=f.run('revealLinkedFile()');f.context.viewerDisposed=true;f.finish(true);await result;assert.equal(f.locates.length,0);
 console.log('PASS: linked-file capability adoption, shared-root reveal, local fallback, focus preservation and stale/close/error/teardown guards');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
