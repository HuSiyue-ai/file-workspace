// 新建只在用户提交名称后发生；父目录固定为打开对话框时的条目，不随导航改变。
const folderDialog=document.getElementById('folder-create-dialog'),folderForm=document.getElementById('folder-create-form');
const folderInput=document.getElementById('folder-create-name'),folderError=document.getElementById('folder-create-error');
const folderSubmit=document.getElementById('folder-create-submit'),folderCancel=document.getElementById('folder-create-cancel');
let folderCreateTarget=null,folderCreateBusy=false;
function openNewFolderDialog(node=directoryRoot){
  if(folderCreateBusy||viewerDisposed||!node)return;
  const parent=node.kind==='directory'?node:node.parent;
  if(!parent||directoryNodes.get(pathKey(parent.path))!==parent)return;
  cancelPendingFilePreview();closeFileActions();setDirectoryMenuVisible(false,false);
  if(typeof setProjectRootMenuVisible==='function')setProjectRootMenuVisible(false,false);
  folderCreateTarget={node:parent,generation:directoryGeneration,session:workspaceSession,anchor:anchorFile?.path};
  document.getElementById('folder-create-parent').textContent=parent.path;
  folderInput.value='';folderError.textContent='';folderSubmit.disabled=false;folderCancel.disabled=false;
  folderDialog.hidden=false;folderInput.focus();
}
function closeNewFolderDialog(focus=true){
  if(folderCreateBusy)return;
  const target=folderCreateTarget;folderCreateTarget=null;folderDialog.hidden=true;
  if(focus)(target?.node?.button?.isConnected?target.node.button:document.getElementById('directory-more')).focus({preventScroll:true});
}
async function submitNewFolder(event){
  event.preventDefault();if(folderCreateBusy||!folderCreateTarget)return;
  const target=folderCreateTarget,name=folderInput.value;
  if(!name.trim()){folderError.textContent='请输入文件夹名称。';folderInput.focus();return;}
  if(target.generation!==directoryGeneration||target.session!==workspaceSession||target.anchor!==anchorFile?.path||directoryNodes.get(pathKey(target.node.path))!==target.node){
    folderError.textContent='文件树位置已改变，请取消后重新选择创建位置。';return;
  }
  folderCreateBusy=true;folderSubmit.disabled=true;folderCancel.disabled=true;folderInput.readOnly=true;folderError.textContent='';
  try{
    const result=await request('tools/call',{name:'create_workspace_directory',arguments:{parent:target.node.path,name,...(target.session?{workspaceSession:target.session}:{})}});
    if(result.isError)throw new Error(result.content?.find(item=>item.type==='text')?.text||'创建失败');
    const data=result.structuredContent;
    if(!data?.created||typeof data.path!=='string')throw new Error('未收到创建结果，请刷新文件树确认，避免重复创建');
    if(viewerDisposed)return;
    folderDialog.hidden=true;folderCreateTarget=null;
    if(target.generation===directoryGeneration&&target.session===workspaceSession&&directoryNodes.get(pathKey(target.node.path))===target.node){
      document.getElementById('directory-filter').value='';target.node.expanded=true;
      await loadDirectoryNode(target.node,true);
      if(target.generation!==directoryGeneration||viewerDisposed)return;
      const created=directoryNodes.get(pathKey(data.path));
      if(created?.button){created.button.scrollIntoView({block:'nearest',inline:'nearest'});created.button.focus({preventScroll:true});}
      directoryNotice('已新建文件夹：'+data.name+(created?'':'。文件树未显示该项，请刷新或检查 500 项限制。'));
    }
  }catch(error){if(!viewerDisposed){folderError.textContent=error.message;folderInput.focus();}}
  finally{folderCreateBusy=false;folderInput.readOnly=false;folderSubmit.disabled=false;folderCancel.disabled=false;}
}
folderForm.addEventListener('submit',submitNewFolder);
folderCancel.addEventListener('click',()=>closeNewFolderDialog());
folderDialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNewFolderDialog();}
  if(event.key==='Tab'){
    const items=[folderInput,folderCancel,folderSubmit].filter(item=>!item.disabled),index=items.indexOf(document.activeElement);
    if(event.shiftKey&&index<=0){event.preventDefault();items.at(-1)?.focus();}
    else if(!event.shiftKey&&index===items.length-1){event.preventDefault();items[0]?.focus();}
  }
});
document.getElementById('directory-new-folder').addEventListener('click',()=>openNewFolderDialog());
document.getElementById('directory-view').addEventListener('contextmenu',event=>{
  if(!directoryRoot||event.target.closest('button,input,textarea'))return;
  showFileActions(event,directoryRoot);
});
window.addEventListener('pagehide',()=>{folderCreateTarget=null;folderDialog.hidden=true;});
