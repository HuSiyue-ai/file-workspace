// Open the conversation project tree without requiring an initial file.
let launcherBusy=false,launcherConnected=false,launcherTicket=null,launcherHomeStarted=false;
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
async function showLauncherHome(){
  if(anchorFile||viewerDisposed||launcherHomeStarted)return;
  launcherHomeStarted=true;
  showEmptyWorkspace('正在载入当前项目的文件树…');
  try{
    const data=unwrapWorkspace(await request('tools/call',{name:'get_workspace_start',arguments:{}}));
    if(viewerDisposed||anchorFile)return;
    if(data.directory&&data.session){setWorkspaceRootChoices(data.roots||[data]);await openWorkspaceDirectory(data);}
    else{
      document.getElementById('launch-caption').textContent='未取得当前项目路径，请选择项目文件夹。';
      setDirectoryVisible(true,'files');
    }
  }catch(e){
    if(!viewerDisposed&&!anchorFile){document.getElementById('launch-caption').textContent='点击“打开文件夹”载入项目文件树。';pickerNotice(e.message,true);setDirectoryVisible(true,'files');}
  }
}
async function openWorkspaceDirectory(data){
  if(!data.directory?.resourceUri||typeof data.session!=='string')throw new Error('没有收到项目文件夹，请重新选择。');
  cancelPendingFilePreview();++readGeneration;
  setDirectoryVisible(false,'files');
  rememberWorkspaceRoot(data);
  workspaceSession=data.session;anchorFile={...data.directory,kind:'directory'};activeFile=null;sourceText='';
  stopEditor();resetSelectedExcerpt();clearOutline();pictureSurface.clear();clearFormatSurfaces();
  preview.replaceChildren();document.getElementById('source').textContent='';document.getElementById('picture-view').hidden=true;
  showEmptyWorkspace('单击右侧文件树中的文件，在这里预览。');
  syncDocumentNavigation({...anchorFile,path:null},false);
  setDirectoryVisible(true,'files');
  document.getElementById('document-area').scrollTo?.({top:0,behavior:'instant'});
}
function launcherFileOpened(){
  loadWorkspaceRootChoices();
  launchHome.hidden=true;
  document.getElementById('directory-toggle').hidden=false;
  document.getElementById('viewer-options').hidden=false;
  document.getElementById('refresh').disabled=false;
  document.getElementById('workspace-open').hidden=!workspaceSession;
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
  launcherBusy=true;syncPickerButtons();document.getElementById('viewer-options').open=false;
  pickerNotice(kind==='directory'?'请在本机选择项目文件夹。':'请在本机选择文件；取消后会保留当前页面。');
  try{
    let data=unwrapWorkspace(await request('tools/call',{name:'begin_workspace_file_selection',arguments:{kind}}));
    const ticket=data.ticket;
    if(typeof ticket!=='string')throw new Error('文件选择服务尚未更新，请完整退出应用后重新打开。');
    launcherTicket=ticket;
    while(data.pending&&!viewerDisposed){
      await new Promise(resolve=>setTimeout(resolve,450));if(viewerDisposed)return;
      data=unwrapWorkspace(await request('tools/call',{name:'poll_workspace_file_selection',arguments:{ticket}}));
    }
    if(viewerDisposed)return;
    if(data.cancelled){pickerNotice('已取消选择。');return;}
    pickerNotice('');
    if(data.directory){await openWorkspaceDirectory(data);return;}
    if(!data.file?.resourceUri||typeof data.session!=='string')throw new Error('没有收到选中的文件，请重试。');
    workspaceSession=data.session;
    const opened=await loadFile(data.file);
    if(opened&&activeFile)setDirectoryVisible(true,'files');
  }catch(e){pickerNotice('打开失败：'+e.message,true);}
  finally{
    if(launcherTicket&&!viewerDisposed)request('tools/call',{name:'cancel_workspace_file_selection',arguments:{ticket:launcherTicket}}).catch(()=>{});
    launcherTicket=null;launcherBusy=false;syncPickerButtons();
  }
}
function cancelWorkspacePicker(){
  if(launcherTicket)request('tools/call',{name:'cancel_workspace_file_selection',arguments:{ticket:launcherTicket}}).catch(()=>{});
  launcherTicket=null;
}
for(const id of ['launch-open','workspace-open'])document.getElementById(id).addEventListener('click',()=>chooseWorkspaceFile('file'));
for(const id of ['launch-folder','workspace-folder'])document.getElementById(id).addEventListener('click',()=>chooseWorkspaceFile('directory'));
