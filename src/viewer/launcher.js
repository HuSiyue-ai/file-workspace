// Open the conversation project tree without requiring an initial file.
let launcherBusy=false,launcherConnected=false,launcherTicket=null,launcherHomeStarted=false;
let launcherHomeTimer=null,launcherHomeEpoch=0,launcherHomePending=false,launcherHomeAttempt=0,launcherHomeFallbackUsed=false;
let launcherProjectChoices=[];
const launcherHomeRetryDelays=[500,1000,2000,4000];
const launchHome=document.getElementById('launch-home');
function unwrapWorkspace(result){
  if(result.isError)throw new Error(result.content?.find(x=>x.type==='text')?.text||'工作区操作失败');
  return result.structuredContent||{};
}
function showEmptyWorkspace(caption){
  launchHome.hidden=false;preview.hidden=true;
  document.getElementById('source').hidden=true;
  document.getElementById('outline-toggle').hidden=true;
  document.getElementById('document-mode').hidden=true;
  document.getElementById('directory-toggle').hidden=false;
  document.getElementById('viewer-options').hidden=false;
  document.getElementById('size').disabled=true;
  document.getElementById('refresh').disabled=true;
  document.getElementById('workspace-open').hidden=false;
  document.getElementById('title').textContent='file-workspace';
  document.getElementById('launch-caption').textContent=caption;
  status.textContent='';
}
function cancelWorkspaceHome(){
  ++launcherHomeEpoch;
  if(launcherHomeTimer!==null){clearTimeout(launcherHomeTimer);launcherHomeTimer=null;}
}
async function showLauncherHome(retry=false){
  if(anchorFile||viewerDisposed||launcherBusy||launcherHomePending||(!retry&&launcherHomeStarted))return;
  if(launcherHomeTimer!==null){clearTimeout(launcherHomeTimer);launcherHomeTimer=null;}
  if(!launcherHomeStarted){launcherHomeStarted=true;showEmptyWorkspace('正在载入当前项目的文件树…');}
  const epoch=launcherHomeEpoch;launcherHomePending=true;
  try{
    const allowSelectedProject=!launcherHomeFallbackUsed;launcherHomeFallbackUsed=true;
    const data=unwrapWorkspace(await request('tools/call',{name:'get_workspace_start',arguments:{allowSelectedProject}}));
    if(viewerDisposed||anchorFile||launcherBusy||epoch!==launcherHomeEpoch)return;
    const roots=data.roots||(data.directory?[data]:[]);
    if(allowSelectedProject&&!data.directory)launcherProjectChoices=roots;
    setWorkspaceRootChoices(data.directory||allowSelectedProject?roots:[...launcherProjectChoices,...roots]);
    if(data.directory&&data.session){await openWorkspaceDirectory(data);}
    else{
      document.getElementById('launch-caption').textContent='可以从文件树顶部的下拉菜单选择这个对话的项目。';
      setDirectoryVisible(true,'files',false);
    }
  }catch(e){
    if(!viewerDisposed&&!anchorFile&&!launcherBusy&&epoch===launcherHomeEpoch){document.getElementById('launch-caption').textContent='点击“打开文件夹”载入项目文件树。';pickerNotice(e.message,true);setDirectoryVisible(true,'files');}
  }finally{
    launcherHomePending=false;
    if(!viewerDisposed&&!anchorFile&&!launcherBusy&&epoch===launcherHomeEpoch){
      const delay=launcherHomeRetryDelays[launcherHomeAttempt++];
      if(delay!==undefined)launcherHomeTimer=setTimeout(()=>{launcherHomeTimer=null;showLauncherHome(true);},delay);
      else document.getElementById('launch-caption').textContent='新对话尚未提供项目路径。请从文件树顶部选择项目，或在发送首条消息后刷新文件树。';
    }
  }
}
function retryWorkspaceHome(){
  if(!launcherConnected||viewerDisposed||anchorFile||launcherBusy)return;
  launcherHomeAttempt=0;return showLauncherHome(true);
}
function resetWorkspacePreview(){
  activeFile=null;sourceText='';
  stopEditor();resetSelectedExcerpt();clearOutline();pictureSurface.clear();clearFormatSurfaces();
  preview.replaceChildren();document.getElementById('source').textContent='';document.getElementById('picture-view').hidden=true;
  showEmptyWorkspace('单击右侧文件树中的文件，在这里预览。');
  document.getElementById('document-area').scrollTo?.({top:0,behavior:'instant'});
}
async function openWorkspaceDirectory(data,directory){
  if(!data.directory?.resourceUri||typeof data.session!=='string')throw new Error('没有收到项目文件夹，请重新选择。');
  cancelWorkspaceHome();pickerNotice('');
  cancelPendingFilePreview();++readGeneration;loadingPreviewPath=null;
  setDirectoryVisible(false,'files');
  rememberWorkspaceRoot(data);
  workspaceSession=data.session;anchorFile={...data.directory,kind:'directory'};
  resetWorkspacePreview();
  syncDocumentNavigation({...anchorFile,path:null},false);
  if(typeof recordWorkspaceLocation!=='function'){setDirectoryVisible(true,'files');return;}
  setDirectoryVisible(true,'files',false);
  if(directory&&Array.isArray(directory.entries)){
    replaceDirectoryData(directory);recordWorkspaceLocation();
  }else if(await loadDirectory(data.directory.path)&&anchorFile.resourceUri===data.directory.resourceUri){
    recordWorkspaceLocation();
  }
}
function launcherFileOpened(){
  cancelWorkspaceHome();
  loadWorkspaceRootChoices();
  launchHome.hidden=true;
  document.getElementById('directory-toggle').hidden=false;
  document.getElementById('viewer-options').hidden=false;
  document.getElementById('refresh').disabled=false;
  document.getElementById('workspace-open').hidden=!workspaceSession;
}
function adoptLinkedWorkspace(data){
  if(!data.directory?.resourceUri||typeof data.session!=='string')throw new Error('目录会话无效，请从文件树重新选择。');
  cancelWorkspaceHome();rememberWorkspaceRoot(data);
  workspaceSession=data.session;anchorFile={...data.directory,kind:'directory'};
}
async function revealLinkedFile(){
  if(!activeFile?.path||viewerDisposed)return;
  const file=activeFile,session=workspaceSession,epoch=readGeneration;
  const current=()=>!viewerDisposed&&file===activeFile&&epoch===readGeneration&&session===workspaceSession;
  // Show the split now, while this operation owns its single awaited request.
  setDirectoryVisible(true,'files',false);
  const localRoots=typeof workspaceRootChoices==='undefined'?[]:workspaceRootChoices.filter(choice=>!choice.directory.host&&pathKey(file.path).startsWith(pathKey(choice.directory.path)+'/')).sort((a,b)=>b.directory.path.length-a.directory.path.length);
  if(!file.host&&typeof selectedWorkspaceRoot!=='undefined')selectedWorkspaceRoot=localRoots.length?workspaceChoiceKey(localRoots[0]):null;
  const root=file.host&&anchorFile?.kind==='directory'?anchorFile.path:localRoots[0]?.directory.path||file.path.replace(/[\\/][^\\/]+$/,'')||'/';
  const loaded=await loadDirectory(root);
  if(!current()||directoryPanel.hidden)return;
  if(loaded)await locateCurrentFile({focus:false});
}
function pickerNotice(text,isError=false){
  const el=document.getElementById('launch-status');el.textContent=text;el.classList.toggle('error',isError);
  if(activeFile)editorNotice(text,isError);
}
function syncPickerButtons(){
  for(const id of ['launch-open','launch-folder','workspace-open','workspace-folder'])document.getElementById(id).disabled=launcherBusy||!launcherConnected;
}
async function chooseWorkspaceFile(kind='file'){
  if(launcherBusy||!launcherConnected||viewerDisposed)return;
  if(!await confirmEditorNavigation())return;
  cancelWorkspaceHome();
  document.getElementById('viewer-options').open=false;
  pickerNotice(kind==='directory'?'请在本机选择项目文件夹。':'请在本机选择文件；取消后会保留当前页面。');
  try{
    await pickWorkspacePath(kind, async data => {
      if(data.cancelled){pickerNotice('已取消选择。');return;}
      pickerNotice('');
      if(data.directory){await openWorkspaceDirectory(data);return;}
      if(!data.file?.resourceUri||typeof data.session!=='string')throw new Error('没有收到选中的文件，请重试。');
      workspaceSession=data.session;
      const opened=await loadFile(data.file);
      if(opened&&activeFile)setDirectoryVisible(true,'files');
    });
  }catch(e){pickerNotice('打开失败：'+e.message,true);}
}
async function pickWorkspacePath(kind, onSelected = data => data){
  if(launcherBusy||!launcherConnected||viewerDisposed)return null;
  launcherBusy=true;syncPickerButtons();
  try{
    let data=unwrapWorkspace(await request('tools/call',{name:'begin_workspace_file_selection',arguments:{kind}}));
    const ticket=data.ticket;
    if(typeof ticket!=='string')throw new Error('文件选择服务尚未更新，请完整退出应用后重新打开。');
    launcherTicket=ticket;
    while(data.pending&&!viewerDisposed){
      await new Promise(resolve=>setTimeout(resolve,450));
      if(viewerDisposed)return null;
      data=unwrapWorkspace(await request('tools/call',{name:'poll_workspace_file_selection',arguments:{ticket}}));
    }
    return viewerDisposed?null:await onSelected(data);
  }
  finally{
    if(launcherTicket&&!viewerDisposed)request('tools/call',{name:'cancel_workspace_file_selection',arguments:{ticket:launcherTicket}}).catch(()=>{});
    launcherTicket=null;launcherBusy=false;syncPickerButtons();
  }
}
function cancelWorkspacePicker(){
  cancelWorkspaceHome();
  if(launcherTicket)request('tools/call',{name:'cancel_workspace_file_selection',arguments:{ticket:launcherTicket}}).catch(()=>{});
  launcherTicket=null;
}
for(const id of ['launch-open','workspace-open'])document.getElementById(id).addEventListener('click',()=>chooseWorkspaceFile('file'));
for(const id of ['launch-folder','workspace-folder'])document.getElementById(id).addEventListener('click',()=>chooseWorkspaceFile('directory'));
