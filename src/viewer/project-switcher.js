// Only roots issued by the backend's current-project resolver/native picker are switchable.
let workspaceRootChoices=[],selectedWorkspaceRoot=null,rootSwitchBusy=false,rootChoicesRequest=null,rootChoicesCheckedAt=0;
const workspaceChoiceKey=choice=>(choice.directory.host?'ssh:'+choice.directory.host+':':'')+pathKey(choice.directory.path);
const projectRootButton=document.getElementById('directory-path'),projectRootMenu=document.getElementById('project-root-menu');
function setWorkspaceRootChoices(choices){
  if(!Array.isArray(choices))return;
  const seen=new Set();workspaceRootChoices=choices.filter(item=>{
    const valid=typeof item?.directory?.path==='string'&&typeof item.directory.resourceUri==='string'&&typeof item.session==='string';
    if(!valid)return false;const key=workspaceChoiceKey(item);if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,40);
  rebuildProjectRootMenu();
}
function rememberWorkspaceRoot(data){
  const key=workspaceChoiceKey(data);selectedWorkspaceRoot=key;
  const index=workspaceRootChoices.findIndex(item=>workspaceChoiceKey(item)===key);
  if(!data.pinned){if(index<0)workspaceRootChoices.push(data);else workspaceRootChoices[index]=data;}
  rebuildProjectRootMenu();
}
function issuedWorkspaceChoices(data){
  return (data.roots||[data]).filter(item=>typeof item?.directory?.path==='string'&&
    typeof item.directory.resourceUri==='string'&&typeof item.session==='string');
}
function fetchWorkspaceRootChoices(includeCatalog=false){
  if(rootChoicesRequest)return rootChoicesRequest;
  rootChoicesRequest=(async()=>{
    const arguments_=includeCatalog?{allowSelectedProject:true}:{};
    const data=unwrapWorkspace(await request('tools/call',{name:'get_workspace_start',arguments:arguments_}));
    const roots=issuedWorkspaceChoices(data);
    if(!viewerDisposed){
      rootChoicesCheckedAt=Date.now();
      if(!selectedWorkspaceRoot&&activeFile&&!activeFile.host){
        const current=pathKey(activeFile.path);
        const choice=roots.find(item=>!item.directory.host&&current.startsWith(pathKey(item.directory.path)+'/'));
        if(choice)selectedWorkspaceRoot=workspaceChoiceKey(choice);
      }
      setWorkspaceRootChoices([...roots,...workspaceRootChoices]);
    }
    return roots;
  })().finally(()=>{rootChoicesRequest=null;});
  return rootChoicesRequest;
}
async function loadWorkspaceRootChoices(refresh=false){
  if(viewerDisposed||(!refresh&&workspaceRootChoices.length)||
      (refresh&&Date.now()-rootChoicesCheckedAt<15000))return;
  try{await fetchWorkspaceRootChoices(refresh);}catch{}
}
function workspaceSessionExpired(error){
  return String(error?.message||error).includes('打开文件的会话已失效');
}
async function findFreshWorkspaceChoice(directory){
  const key=workspaceChoiceKey({directory});
  const matches=choice=>workspaceChoiceKey(choice)===key&&
    (!directory.host||choice.directory.resourceUri===directory.resourceUri);
  const roots=await fetchWorkspaceRootChoices();
  const choice=roots.find(matches);
  if(choice||viewerDisposed)return choice;
  if(directory.host){
    const root=roots.find(item=>item.directory.resourceUri===directory.resourceUri&&item.directory.host===directory.host&&
      pathKey(directory.path).startsWith(pathKey(item.directory.path)+'/'));
    return root?{directory,session:root.session}:undefined;
  }
  if(typeof callWorkspacePins==='function'){
    const {pins}=await callWorkspacePins('list');
    const pinned=pins.find(pin=>pinnedMatches(pin,directory));
    if(pinned)return callWorkspacePins('open',{id:pinned.id});
  }
  // A draft can offer saved projects for selection. Renew only the exact directory it already had.
  const catalog=unwrapWorkspace(await request('tools/call',{name:'get_workspace_start',arguments:{allowSelectedProject:true}}));
  const confirmed=issuedWorkspaceChoices(catalog).find(matches);
  if(confirmed&&!viewerDisposed)setWorkspaceRootChoices([confirmed,...workspaceRootChoices]);
  return confirmed;
}
async function requestWorkspaceRead(name,arguments_){
  const directory=anchorFile,session=workspaceSession;
  const read=async token=>{
    const response=await request('tools/call',{name,arguments:{...arguments_,workspaceSession:token}});
    if(response.isError)unwrapWorkspace(response);
    return response;
  };
  try{return await read(session);}
  catch(error){
    if(!workspaceSessionExpired(error)||!session||directory?.kind!=='directory'||viewerDisposed)throw error;
    if(directory!==anchorFile)throw error;
    if(workspaceSession===session){
      const fresh=await findFreshWorkspaceChoice(directory);
      if(viewerDisposed||directory!==anchorFile||!fresh)throw error;
      if(workspaceSession===session)workspaceSession=fresh.session;
    }
    return read(workspaceSession);
  }
}
function rebuildProjectRootMenu(){
  const focused=document.activeElement?.workspaceRootMenuKey;
  projectRootMenu.replaceChildren();
  for(const choice of workspaceRootChoices){
    const button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span'),tick=document.createElement('span');
    button.workspaceRootMenuKey=workspaceChoiceKey(choice);
    button.type='button';button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(workspaceChoiceKey(choice)===selectedWorkspaceRoot));button.title=choice.directory.path;button.disabled=rootSwitchBusy;
    icon.textContent='📁';icon.setAttribute('aria-hidden','true');label.className='root-name';label.textContent=choice.directory.name||pathName(choice.directory.path);
    tick.className='root-tick';tick.textContent=workspaceChoiceKey(choice)===selectedWorkspaceRoot?'✓':'';tick.setAttribute('aria-hidden','true');button.append(icon,label,tick);
    button.addEventListener('click',()=>switchWorkspaceRoot(choice));projectRootMenu.append(button);
  }
  if(typeof appendWorkspacePins==='function')appendWorkspacePins(projectRootMenu);
  else if(workspaceRootChoices.length)projectRootMenu.append(document.createElement('hr'));
  const choose=document.createElement('button');choose.type='button';choose.setAttribute('role','menuitem');choose.textContent='打开其他文件夹…';choose.disabled=rootSwitchBusy;
  choose.workspaceRootMenuKey='';
  choose.addEventListener('click',()=>{setProjectRootMenuVisible(false,false);chooseWorkspaceFile('directory');});projectRootMenu.append(choose);
  if(focused!==undefined&&!projectRootMenu.hidden)
    projectRootItems().find(button=>button.workspaceRootMenuKey===focused)?.focus({preventScroll:true});
}
function projectRootItems(){return [...projectRootMenu.querySelectorAll('button')].filter(item=>!item.disabled);}
function setProjectRootMenuVisible(visible,focus=true,last=false){
  visible=visible&&!directoryPanel.hidden&&navigationMode==='files'&&!rootSwitchBusy;
  if(visible){cancelPendingFilePreview();setDirectoryMenuVisible(false,false);rebuildProjectRootMenu();void loadWorkspaceRootChoices(true);if(typeof loadPinnedFolders==='function')loadPinnedFolders();}
  projectRootMenu.hidden=!visible;projectRootButton.setAttribute('aria-expanded',String(visible));
  if(focus)(visible?(last?projectRootItems().at(-1):projectRootItems()[0]):projectRootButton)?.focus();
}
async function switchWorkspaceRoot(choice,resolveChoice){
  if(rootSwitchBusy||viewerDisposed)return;
  setProjectRootMenuVisible(false,false);cancelPendingFilePreview();
  if(choice&&selectedWorkspaceRoot===workspaceChoiceKey(choice)&&pathKey(directoryRoot?.path)===pathKey(choice.directory.path))return;
  rootSwitchBusy=true;
  try{
    if(!await confirmEditorNavigation()||viewerDisposed)return;
    if(resolveChoice)choice=await resolveChoice();
    if(viewerDisposed)return;
    if(choice.directory.host)directoryNotice('正在连接 '+choice.directory.host+'…');
    // Check first: a removed/inaccessible root must not clear the current preview/tree.
    const check=async()=>unwrapWorkspace(await request('tools/call',{name:'list_markdown_directory',
      arguments:{directory:choice.directory.path,workspaceSession:choice.session}}));
    let directory;
    try{directory=await check();}
    catch(error){
      if(!workspaceSessionExpired(error)||viewerDisposed)throw error;
      const fresh=await findFreshWorkspaceChoice(choice.directory);
      if(!fresh||viewerDisposed)throw error;
      choice=fresh;
      directory=await check();
    }
    // SSH may take time: do not discard edits made while the connection was pending.
    if(!viewerDisposed&&await confirmEditorNavigation()&&!viewerDisposed)await openWorkspaceDirectory(choice,directory);
  }catch(e){directoryNotice('切换失败：'+e.message,true);}
  finally{rootSwitchBusy=false;rebuildProjectRootMenu();}
}
projectRootButton.addEventListener('click',()=>setProjectRootMenuVisible(projectRootMenu.hidden));
projectRootButton.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setProjectRootMenuVisible(true,true,event.key==='ArrowUp');}
});
projectRootMenu.addEventListener('keydown',event=>{
  const items=projectRootItems(),index=items.indexOf(document.activeElement);let target;
  if(event.key==='ArrowDown')target=items[(index+1)%items.length];else if(event.key==='ArrowUp')target=items[(index-1+items.length)%items.length];
  else if(event.key==='Home')target=items[0];else if(event.key==='End')target=items.at(-1);else return;
  event.preventDefault();target?.focus();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!projectRootMenu.hidden){event.preventDefault();event.stopPropagation();setProjectRootMenuVisible(false);}},true);
for(const type of ['pointerdown','focusin'])document.addEventListener(type,event=>{if(!projectRootMenu.hidden&&!projectRootMenu.contains(event.target)&&!projectRootButton.contains(event.target))setProjectRootMenuVisible(false,false);},true);
for(const type of ['resize','blur','pagehide'])window.addEventListener(type,()=>setProjectRootMenuVisible(false,false));
if(typeof appendWorkspacePins!=='function')rebuildProjectRootMenu();
