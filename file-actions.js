// 文件树右键只作用于点中的条目；不切换正文，不读入整份文件，不自动发送消息。
const fileActions=document.getElementById('file-actions');
const fileActionIds=['file-copy-path','file-add-chat','file-new-folder','file-open-host','file-copy-name'];
const fileCopyFallback=document.getElementById('file-copy-fallback');
const fileCopyValue=document.getElementById('file-copy-value');
let fileActionTarget=null,fileActionBusy=false,fileActionPoint=null;
function fileActionItems(){return fileActionIds.map(id=>document.getElementById(id)).filter(button=>!button.disabled);}
function updateFileActions(){
  for(const id of fileActionIds)document.getElementById(id).disabled=fileActionBusy;
  const add=document.getElementById('file-add-chat');add.disabled=fileActionBusy||!selectionDraftAvailable;
  add.title=selectionDraftAvailable?'将文件名和完整路径加入当前聊天草稿，不附加整份文件，不自动发送':'当前窗口没有对话草稿接口，请在聊天旁打开文件后使用';
  document.getElementById('file-open-host').disabled=fileActionBusy||!hostFileOpenAvailable||!fileActionTarget?.button;
}
function closeFileActions(focus=false){
  const target=fileActionTarget;fileActionTarget=null;fileActions.hidden=true;
  target?.button?.classList.toggle('context-target',false);
  fileCopyFallback.hidden=true;fileCopyValue.value='';
  if(focus&&target?.button?.isConnected)target.button.focus({preventScroll:true});
}
function positionFileActions(){
  const rect=fileActions.getBoundingClientRect(),point=fileActionPoint||{x:8,y:8};
  fileActions.style.left=Math.max(8,Math.min(window.innerWidth-rect.width-8,point.x))+'px';
  fileActions.style.top=Math.max(8,Math.min(window.innerHeight-rect.height-8,point.y))+'px';
}
function showFileActions(event,node){
  if(viewerDisposed||directoryNodes.get(pathKey(node.path))!==node)return;
  event.preventDefault();event.stopPropagation();cancelPendingFilePreview();resetSelectedExcerpt();
  setDirectoryMenuVisible(false,false);closeFileActions();fileActionTarget=node;
  const keyboard=event.type==='keydown',rect=(node.button||directoryList).getBoundingClientRect();
  fileActionPoint=keyboard?{x:rect.left+16,y:rect.bottom}:{x:event.clientX,y:event.clientY};
  node.button?.classList.toggle('context-target',true);
  document.getElementById('file-action-name').textContent=node.name;
  document.getElementById('file-action-name').title=node.path;
  updateFileActions();fileActions.hidden=false;positionFileActions();
  (fileActionItems()[0]||fileActions).focus({preventScroll:true});
}
async function copyFileActionText(text){
  // 优先标准 Clipboard API；内嵌页无权限时再尝试兼容复制。
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{}}
  const previous=document.activeElement,input=document.createElement('textarea');
  input.value=text;input.readOnly=true;input.setAttribute('aria-label','临时复制内容');
  input.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0';
  document.body.append(input);
  let copied=false;
  try{input.focus({preventScroll:true});input.select();copied=document.execCommand?.('copy')===true;}
  catch{}finally{input.setSelectionRange?.(0,0);document.getSelection?.()?.removeAllRanges();input.remove();if(previous?.isConnected)previous.focus({preventScroll:true});}
  if(copied)return;
  throw new Error('当前窗口未允许直接写入剪贴板');
}
function manualFileCopy(node,text){
  if(viewerDisposed||directoryNodes.get(pathKey(node.path))!==node)return;
  showFileActions({type:'keydown',preventDefault(){},stopPropagation(){}},node);
  fileCopyValue.value=text;fileCopyFallback.hidden=false;positionFileActions();
  fileCopyValue.focus({preventScroll:true});fileCopyValue.select();
}
async function performFileAction(action){
  const node=fileActionTarget;
  if(fileActionBusy||!node)return;
  if(directoryNodes.get(pathKey(node.path))!==node){closeFileActions();excerptNotice('目录已更新，请重新右键选择文件。',true);return;}
  if(action==='chat'&&!selectionDraftAvailable){excerptNotice('当前窗口没有对话草稿接口。',true);return;}
  if(action==='open'&&!hostFileOpenAvailable){excerptNotice('当前窗口不支持交给应用打开。',true);return;}
  if(action==='mkdir'){openNewFolderDialog(node);return;}
  closeFileActions(true);fileActionBusy=true;
  try{
    if(action==='path'||action==='name'){
      await copyFileActionText(action==='path'?node.path:node.name);
      if(!viewerDisposed)excerptNotice(action==='path'?'已复制完整路径。':'已复制名称。');
    }else if(action==='chat'){
      await request('ui/message',{
        role:'user',content:[{type:'text',text:(node.kind==='directory'?'本地文件夹：':'本地文件：')+node.name+'\n完整路径：'+node.path,
          _meta:{'openai/title':node.name+' · 本地路径'}}],
        _meta:{'openai/message':{target:'active',send:false}}
      });
      if(!viewerDisposed)excerptNotice('文件名和完整路径已加入聊天草稿，尚未发送；未附加整份文件。');
    }else if(action==='open'){
      await openDirectoryFile(node);
    }
  }catch(error){
    if(!viewerDisposed){
      if(action==='path'||action==='name'){
        manualFileCopy(node,action==='path'?node.path:node.name);
        excerptNotice('无法直接复制，已选中内容，请按 Ctrl+C。',true);
      }else excerptNotice('添加失败：'+error.message+'；可重新右键后再试。',true);
    }
  }finally{fileActionBusy=false;if(!fileActions.hidden)updateFileActions();}
}
for(const [id,action] of [['file-copy-path','path'],['file-add-chat','chat'],['file-new-folder','mkdir'],['file-open-host','open'],['file-copy-name','name']])document.getElementById(id).addEventListener('click',()=>performFileAction(action));
fileActions.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeFileActions(true);return;}
  if(event.target===fileCopyValue)return;
  const items=fileActionItems(),index=items.indexOf(document.activeElement);let next;
  if(event.key==='ArrowDown')next=items[(index+1)%items.length];
  else if(event.key==='ArrowUp')next=items[(index-1+items.length)%items.length];
  else if(event.key==='Home')next=items[0];else if(event.key==='End')next=items.at(-1);else return;
  event.preventDefault();next?.focus();
});
for(const type of ['pointerdown','focusin'])document.addEventListener(type,event=>{
  if(!fileActions.hidden&&!fileActions.contains(event.target))closeFileActions();
},true);
document.addEventListener('scroll',event=>{if(!fileActions.hidden&&!fileActions.contains(event.target))closeFileActions();},true);
window.addEventListener('resize',()=>closeFileActions());window.addEventListener('blur',()=>closeFileActions());window.addEventListener('pagehide',()=>closeFileActions());
