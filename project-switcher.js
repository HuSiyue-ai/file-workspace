// Only roots issued by the backend's current-project resolver/native picker are switchable.
let workspaceRootChoices=[],selectedWorkspaceRoot=null,rootSwitchBusy=false,rootChoicesLoading=false;
const projectRootButton=document.getElementById('directory-path'),projectRootMenu=document.getElementById('project-root-menu');
function setWorkspaceRootChoices(choices){
  if(!Array.isArray(choices))return;
  const seen=new Set();workspaceRootChoices=choices.filter(item=>{
    const valid=typeof item?.directory?.path==='string'&&typeof item.directory.resourceUri==='string'&&typeof item.session==='string';
    if(!valid)return false;const key=pathKey(item.directory.path);if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,32);
  rebuildProjectRootMenu();
}
function rememberWorkspaceRoot(data){
  const key=pathKey(data.directory.path);selectedWorkspaceRoot=key;
  const index=workspaceRootChoices.findIndex(item=>pathKey(item.directory.path)===key);
  if(index<0)workspaceRootChoices.push(data);else workspaceRootChoices[index]=data;
  rebuildProjectRootMenu();
}
async function loadWorkspaceRootChoices(){
  if(rootChoicesLoading||workspaceRootChoices.length||viewerDisposed)return;
  rootChoicesLoading=true;
  try{
    const data=unwrapWorkspace(await request('tools/call',{name:'get_workspace_start',arguments:{}}));
    if(!viewerDisposed&&!workspaceRootChoices.length){
      setWorkspaceRootChoices(data.roots||[data]);
      const current=pathKey(activeFile?.path||'');
      selectedWorkspaceRoot=workspaceRootChoices.find(item=>current.startsWith(pathKey(item.directory.path)+'/'))?.directory.path;
      if(selectedWorkspaceRoot)selectedWorkspaceRoot=pathKey(selectedWorkspaceRoot);
      rebuildProjectRootMenu();
    }
  }catch{}finally{rootChoicesLoading=false;}
}
function rebuildProjectRootMenu(){
  projectRootMenu.replaceChildren();
  for(const choice of workspaceRootChoices){
    const button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span'),tick=document.createElement('span');
    button.type='button';button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(pathKey(choice.directory.path)===selectedWorkspaceRoot));button.title=choice.directory.path;button.disabled=rootSwitchBusy;
    icon.textContent='📁';icon.setAttribute('aria-hidden','true');label.className='root-name';label.textContent=choice.directory.name||pathName(choice.directory.path);
    tick.className='root-tick';tick.textContent=pathKey(choice.directory.path)===selectedWorkspaceRoot?'✓':'';tick.setAttribute('aria-hidden','true');button.append(icon,label,tick);
    button.addEventListener('click',()=>switchWorkspaceRoot(choice));projectRootMenu.append(button);
  }
  if(workspaceRootChoices.length)projectRootMenu.append(document.createElement('hr'));
  const choose=document.createElement('button');choose.type='button';choose.setAttribute('role','menuitem');choose.textContent='打开其他文件夹…';choose.disabled=rootSwitchBusy;
  choose.addEventListener('click',()=>{setProjectRootMenuVisible(false,false);chooseWorkspaceFile('directory');});projectRootMenu.append(choose);
}
function projectRootItems(){return [...projectRootMenu.querySelectorAll('button')].filter(item=>!item.disabled);}
function setProjectRootMenuVisible(visible,focus=true,last=false){
  visible=visible&&!directoryPanel.hidden&&navigationMode==='files'&&!rootSwitchBusy;
  if(visible){cancelPendingFilePreview();setDirectoryMenuVisible(false,false);rebuildProjectRootMenu();}
  projectRootMenu.hidden=!visible;projectRootButton.setAttribute('aria-expanded',String(visible));
  if(focus)(visible?(last?projectRootItems().at(-1):projectRootItems()[0]):projectRootButton)?.focus();
}
async function switchWorkspaceRoot(choice){
  if(rootSwitchBusy||viewerDisposed)return;
  setProjectRootMenuVisible(false,false);cancelPendingFilePreview();
  if(selectedWorkspaceRoot===pathKey(choice.directory.path)&&pathKey(directoryRoot?.path)===pathKey(choice.directory.path))return;
  rootSwitchBusy=true;
  try{
    if(!await confirmEditorNavigation()||viewerDisposed)return;
    // Check first: a removed/inaccessible root must not clear the current preview/tree.
    unwrapWorkspace(await request('tools/call',{name:'list_markdown_directory',arguments:{directory:choice.directory.path,workspaceSession:choice.session}}));
    if(!viewerDisposed)await openWorkspaceDirectory(choice);
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
rebuildProjectRootMenu();
