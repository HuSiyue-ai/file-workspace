const recycleDialog=document.getElementById('file-recycle-dialog');
const recycleTitle=document.getElementById('file-recycle-title');
const recyclePath=document.getElementById('file-recycle-path');
const recycleList=document.getElementById('file-recycle-list');
const recycleNotice=document.getElementById('file-recycle-status');
const recycleConfirm=document.getElementById('file-recycle-confirm');
const recycleCancel=document.getElementById('file-recycle-cancel');
let recycleOperationBusy=false,recycleDialogGeneration=0;

function recycleRequest(action,args,session){
  return request('tools/call',{name:'recycle_workspace_file',arguments:{action,...args,workspaceSession:session}}).then(unwrapWorkspace);
}
function openRecycleDialog(title,description){
  recycleTitle.textContent=title;
  recyclePath.textContent=description;
  recycleList.replaceChildren();
  recycleNotice.textContent='';
  recycleConfirm.hidden=true;
  recycleConfirm.onclick=null;
  ++recycleDialogGeneration;
  recycleDialog.showModal();
  recycleCancel.focus();
}
function deletingEditedFile(path){
  return editorSession&&pathKey(editorSession.path)===pathKey(path)&&(editorDirty()||editorSession.saving);
}
function clearDeletedPreview(path){
  const pendingPath=pathKey(loadingPreviewPath);
  if((pendingPath||pathKey(activeFile?.path))!==pathKey(path))return;
  ++readGeneration;loadingPreviewPath=null;activeFile=null;sourceText='';
  stopEditor();resetSelectedExcerpt();clearOutline();pictureSurface.clear();clearFormatSurfaces();
  preview.replaceChildren();
  document.getElementById('source').textContent='';
  document.getElementById('picture-view').hidden=true;
  if(directoryData)directoryData.documentPath=null;
  markDirectoryCurrent();
  showEmptyWorkspace('单击右侧文件树中的文件，在这里预览。');
}
async function refreshRecycledParent(path){
  const parent=directoryNodes.get(pathKey(path));
  if(parent?.loaded)await loadDirectoryNode(parent,true);
}
async function showDeleteFile(node){
  if(recycleDialog.open||node.kind!=='file')return;
  const session=workspaceSession;
  const remote=workspaceRemoteHost();
  const current=()=>!viewerDisposed&&session===workspaceSession;
  openRecycleDialog('删除 '+node.name,node.path);
  const generation=recycleDialogGeneration;
  recycleCancel.textContent='取消';
  recycleConfirm.textContent=remote?'移到服务器回收目录':'移到 Windows 回收站';
  const checkEditor=()=>{
    if(!deletingEditedFile(node.path))return true;
    recycleNotice.textContent='此文件有正在保存或未保存的修改。请先保存或退出编辑，再删除。';
    return false;
  };
  if(!checkEditor())return;
  recycleNotice.textContent='正在检查文件…';
  try{
    const data=await recycleRequest('inspect',{path:node.path},session);
    if(!recycleDialog.open||!current()||generation!==recycleDialogGeneration)return;
    if(!data.revision)throw new Error('无法取得文件版本，请重新打开预览');
    recycleNotice.textContent=remote?'文件会移到服务器回收目录，可从文件树菜单恢复。':'文件会移到 Windows 回收站。';
    recycleConfirm.hidden=false;
    recycleConfirm.onclick=async()=>{
      if(recycleOperationBusy||!current()||!checkEditor())return;
      setRecycleBusy(true);
      try{
        const result=await recycleRequest('delete',{path:node.path,revision:data.revision},session);
        if(!result.deleted)throw new Error('服务没有确认删除结果');
        if(!current())return;
        if(result.workspace){
          workspaceSession=result.workspace.session;
          anchorFile={...result.workspace.directory,kind:'directory'};
        }
        clearDeletedPreview(node.path);
        recycleDialog.close();
        await refreshRecycledParent(result.parent);
        if(!viewerDisposed)directoryNotice('已移到'+(remote?'服务器回收目录':'Windows 回收站')+' · '+node.name);
      }catch(error){recycleNotice.textContent='删除失败 · '+error.message;}
      finally{setRecycleBusy(false);}
    };
  }catch(error){
    if(recycleDialog.open&&current()&&generation===recycleDialogGeneration)recycleNotice.textContent=error.message;
  }
}
function setRecycleBusy(busy){
  recycleOperationBusy=busy;
  recycleCancel.disabled=recycleConfirm.disabled=busy;
  for(const button of recycleList.querySelectorAll('button'))button.disabled=busy;
}
async function showRecycleList(){
  if(!workspaceRemoteHost()||recycleDialog.open)return;
  setDirectoryMenuVisible(false,false);
  const session=workspaceSession;
  openRecycleDialog('恢复已删除文件','文件将恢复到原来的文件夹。');
  const generation=recycleDialogGeneration;
  recycleCancel.textContent='关闭';
  recycleNotice.textContent='正在读取服务器回收目录…';
  try{
    const result=await recycleRequest('list',{},session);
    if(!recycleDialog.open||generation!==recycleDialogGeneration||session!==workspaceSession||viewerDisposed)return;
    for(const item of result.entries){
      const row=document.createElement('li'),details=document.createElement('span');
      const name=document.createElement('strong'),path=document.createElement('small'),button=document.createElement('button');
      name.textContent=item.name;path.textContent=item.path;
      button.type='button';button.textContent='恢复';button.setAttribute('aria-label','恢复 '+item.path);
      details.append(name,path);row.append(details,button);recycleList.append(row);
      button.addEventListener('click',async()=>{
        if(recycleOperationBusy||session!==workspaceSession)return;
        setRecycleBusy(true);
        try{
          const restored=await recycleRequest('restore',{id:item.id},session);
          if(!restored.restored)throw new Error('服务没有确认恢复结果');
          row.remove();
          await refreshRecycledParent(restored.parent);
          recycleNotice.textContent='已恢复 '+item.name;
          recycleCancel.focus();
        }catch(error){recycleNotice.textContent='恢复失败 · '+error.message;}
        finally{setRecycleBusy(false);}
      });
    }
    recycleNotice.textContent=result.entries.length?'':'回收目录为空。';
  }catch(error){
    if(recycleDialog.open&&generation===recycleDialogGeneration)recycleNotice.textContent=error.message;
  }
}
recycleDialog.addEventListener('cancel',event=>{if(recycleOperationBusy)event.preventDefault();});
recycleCancel.addEventListener('click',()=>{if(!recycleOperationBusy)recycleDialog.close();});
document.getElementById('directory-restore-file').addEventListener('click',showRecycleList);
