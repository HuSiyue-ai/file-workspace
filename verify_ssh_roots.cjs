// SSH/local roots share the menu but never share capabilities or identities.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag='button'){this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;this.attributes={};this.events={};}
 addEventListener(n,f){this.events[n]=f;}setAttribute(n,v){this.attributes[n]=v;}
 replaceChildren(){this.children=[];}append(...items){this.children.push(...items);}contains(){return false;}focus(){}
 querySelectorAll(tag){return this.children.filter(item=>item.tag===tag);}
}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const calls=[],opened=[],notices=[];let allow=true,fail=false;
const context={document:{getElementById:get,createElement:tag=>new Element(tag),addEventListener(){}},window:{addEventListener(){}},
 directoryPanel:get('panel'),navigationMode:'files',directoryRoot:{path:'C:/local'},activeFile:{path:'C:/local/a.md'},viewerDisposed:false,
 pathKey:p=>String(p||''),pathName:p=>p.split('/').pop(),cancelPendingFilePreview(){},setDirectoryMenuVisible(){},chooseWorkspaceFile(){},
 unwrapWorkspace:r=>r.structuredContent,
 confirmEditorNavigation:async()=>allow,
 request:async(method,params)=>{calls.push(params);if(fail)throw Error('SSH offline');return {structuredContent:{}};},
 openWorkspaceDirectory:async choice=>opened.push(choice),directoryNotice:(...args)=>notices.push(args)};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/project-switcher.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
context.local={directory:{name:'local',path:'C:/local',resourceUri:'local:root'},session:'local-token'};
context.remote={directory:{name:'SSH',path:'/shared',resourceUri:'ssh:root',host:'lab'},session:'ssh-token'};
context.other={directory:{name:'Other',path:'/shared',resourceUri:'ssh:other',host:'other'},session:'other-token'};
async function main(){
 run('setWorkspaceRootChoices([local,remote,other,remote])');assert.equal(run('workspaceRootChoices.length'),3);
 await run('switchWorkspaceRoot(remote)');assert.equal(calls.at(-1).arguments.workspaceSession,'ssh-token');assert.equal(opened.at(-1).directory.host,'lab');
 run('rememberWorkspaceRoot(remote)');context.directoryRoot={path:'/shared'};
 const count=calls.length;await run('switchWorkspaceRoot(remote)');assert.equal(calls.length,count,'current remote root does not reload');
 allow=false;await run('switchWorkspaceRoot(local)');assert.equal(calls.length,count,'cancel unsaved changes before network access');
 allow=true;fail=true;await run('switchWorkspaceRoot(local)');assert.equal(opened.length,1,'failed switch retains current view');assert.match(notices.at(-1)[0],/SSH offline/);
 fail=false;await run('switchWorkspaceRoot(local)');assert.equal(calls.at(-1).arguments.workspaceSession,'local-token');assert.equal(opened.at(-1).directory.path,'C:/local');
 const expired='打开文件的会话已失效，请点击打开文件重新选择。';
 const renewed={...context.local,session:'renewed-token'};
 const additional={directory:{name:'added',path:'C:/added',resourceUri:'local:added'},session:'added-token'};
 context.anchorFile={...context.local.directory,kind:'directory'};
 let mode='project',fetches=0;
 context.request=async(method,params)=>{
   if(params.name==='get_workspace_start'){
     fetches++;
     const roots=mode==='project'?[renewed,additional,context.remote]
       :params.arguments.allowSelectedProject?(mode==='draft'?[renewed]:[additional]):[];
     return {structuredContent:{roots}};
   }
   if(params.arguments.workspaceSession==='expired-token')throw Error(expired);
   assert.equal(params.arguments.workspaceSession,'renewed-token');
   return {structuredContent:{directory:'C:/local',entries:[]}};
 };
 const list=()=>run("requestWorkspaceRead('list_markdown_directory',{directory:'C:/local/subdir'})");
 context.workspaceSession='expired-token';
 await Promise.all([list(),run("requestWorkspaceRead('read_preview_file',{path:'C:/local/a.md'})")]);
 assert.equal(fetches,1,'concurrent reads share the project lookup');
 assert.equal(context.workspaceSession,'renewed-token');
 assert(run("workspaceRootChoices.some(choice=>choice.directory.path==='C:/added')"));
 assert.equal(opened.length,2,'available root updates do not switch the open directory');
 context.workspaceSession='expired-token';mode='draft';
 await list();assert.equal(context.workspaceSession,'renewed-token');
 context.workspaceSession='expired-token';mode='unrelated';
 await assert.rejects(list(),/会话已失效/);
 assert.equal(context.workspaceSession,'expired-token','an unrelated selected project cannot renew the token');
 context.anchorFile={...context.remote.directory,kind:'directory'};
 context.request=async(method,params)=>{
   if(params.name==='get_workspace_start')return {structuredContent:{roots:[{...context.remote,session:'fresh-ssh'}]}};
   if(params.arguments.workspaceSession==='expired-token')return {isError:true,content:[{type:'text',text:expired}]};
   assert.equal(params.arguments.workspaceSession,'fresh-ssh');
   return {structuredContent:{directory:'/shared',entries:[]}};
 };
 context.unwrapWorkspace=response=>{if(response.isError)throw Error(response.content[0].text);return response.structuredContent;};
 await run("requestWorkspaceRead('list_markdown_directory',{directory:'/shared'})");
 assert.equal(context.workspaceSession,'fresh-ssh');
 console.log('PASS: distinct SSH identities, explicit capabilities, current-root no-op, unsaved cancellation, failed-switch preservation and return to local');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
