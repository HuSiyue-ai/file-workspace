// 使用宿主的草稿接口添加引用；选中或右键本身不发送任何内容。
const selectionToolbar=document.getElementById('selection-toolbar');
const selectionAdd=document.getElementById('selection-add');
const selectionStatus=document.getElementById('selection-status');
let selectedExcerpt=null,selectionBusy=false,selectionMessageTimer=null;
let selectionDraftAvailable=false;
function setSelectionHostCapabilities(capabilities){
  selectionDraftAvailable=!!capabilities?.experimental?.['openai/message']&&!!capabilities?.message?.text;
  updateSelectionAction();
}
function updateSelectionAction(){
  selectionAdd.disabled=selectionBusy||!selectionDraftAvailable;
  if(typeof updateExcerptCommentActions==='function')updateExcerptCommentActions();
  selectionAdd.textContent=selectionBusy?'正在添加…':'添加到对话';
  selectionAdd.title=selectionDraftAvailable?'加入当前对话输入框，补充问题后再发送':'当前窗口未提供对话草稿接口，请回到有对话输入框的窗口使用';
}
function resetSelectedExcerpt(){selectedExcerpt=null;selectionToolbar.hidden=true;}
function excerptFromSelection(){
  if(!activeFile)return null;
  const selection=window.getSelection();
  if(!selection||selection.isCollapsed||selection.rangeCount!==1)return null;
  const range=selection.getRangeAt(0);
  const containers=[preview,document.getElementById('source')];
  if(!containers.some(container=>!container.hidden&&container.contains(range.startContainer)&&container.contains(range.endContainer)))return null;
  const text=selection.toString().trim();
  if(!text)return null;
  return{text,name:activeFile.name||'Markdown 文件',uri:activeFile.resourceUri,range};
}
function positionSelectionToolbar(range,point){
  const rect=point?{left:point.x,right:point.x,top:point.y,bottom:point.y}:range.getBoundingClientRect();
  selectionToolbar.hidden=false;
  const width=selectionToolbar.offsetWidth||130,height=selectionToolbar.offsetHeight||38;
  const left=Math.max(8,Math.min(window.innerWidth-width-8,(rect.left+rect.right-width)/2));
  const top=rect.top-height-8>=50?rect.top-height-8:Math.max(50,rect.bottom+8);
  selectionToolbar.style.left=left+'px';
  selectionToolbar.style.top=Math.max(8,Math.min(window.innerHeight-height-8,top))+'px';
}
function refreshSelectedExcerpt(point){
  const comments=document.getElementById('excerpt-comment-dialog');
  const quick=document.getElementById('excerpt-quick-editor');
  if(selectionBusy||(comments&&!comments.hidden)||(quick&&!quick.hidden))return;
  const excerpt=excerptFromSelection();
  if(!excerpt){resetSelectedExcerpt();return;}
  selectedExcerpt=excerpt;updateSelectionAction();positionSelectionToolbar(excerpt.range,point);
}
function excerptNotice(text,isError=false){
  clearTimeout(selectionMessageTimer);
  selectionStatus.textContent=text;selectionStatus.classList.toggle('error',isError);selectionStatus.hidden=false;
  selectionMessageTimer=setTimeout(()=>{selectionStatus.hidden=true;},isError?9000:4500);
}
async function addSelectedExcerpt(){
  const excerpt=selectedExcerpt;
  if(selectionBusy||!excerpt||excerpt.uri!==activeFile?.resourceUri)return;
  if(!selectionDraftAvailable){excerptNotice('当前窗口没有可用的对话输入框，请在对话旁打开文件后重试。',true);return;}
  if(excerpt.text.length>100000){excerptNotice('所选内容太长，请缩小到 10 万字以内再添加。',true);return;}
  selectionBusy=true;updateSelectionAction();
  try{
    await request('ui/message',{
      role:'user',
      content:[{type:'text',text:'文件：'+excerpt.name+'\n所选文段：\n'+excerpt.text,_meta:{'openai/title':excerpt.name+' · 选中文段'}}],
      _meta:{'openai/message':{target:'active',send:false}}
    });
    resetSelectedExcerpt();
    excerptNotice('已添加到对话输入框，可以补充问题后发送。');
  }catch(error){excerptNotice('添加失败：'+error.message+'；可重新选中文段后再试。',true);}
  finally{selectionBusy=false;updateSelectionAction();}
}
selectionAdd.addEventListener('pointerdown',event=>event.preventDefault());
selectionAdd.addEventListener('click',addSelectedExcerpt);
document.addEventListener('selectionchange',()=>refreshSelectedExcerpt());
function isDocumentSelectionTarget(target){return [preview,document.getElementById('source')].some(container=>!container.hidden&&container.contains(target));}
document.addEventListener('pointerup',event=>{if(isDocumentSelectionTarget(event.target))refreshSelectedExcerpt();});
document.addEventListener('contextmenu',event=>{
  if(!isDocumentSelectionTarget(event.target))return;
  const excerpt=excerptFromSelection();
  if(!excerpt)return;
  event.preventDefault();refreshSelectedExcerpt({x:event.clientX,y:event.clientY});
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')resetSelectedExcerpt();});
document.addEventListener('scroll',()=>{selectionToolbar.hidden=true;},true);
window.addEventListener('resize',()=>{selectionToolbar.hidden=true;});
window.addEventListener('blur',()=>{selectionToolbar.hidden=true;});
updateSelectionAction();
