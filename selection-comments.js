// 批注仅在本标签页暂存；点击加入草稿才交给宿主，不写文件、不自动发送。
var excerptCommentUIReady=false;
const excerptCommentButton=document.getElementById('selection-comment');
const excerptCommentDialog=document.getElementById('excerpt-comment-dialog');
const excerptCommentList=document.getElementById('excerpt-comment-list');
const excerptCommentOpen=document.getElementById('excerpt-comments-open');
const excerptCommentSend=document.getElementById('excerpt-comments-send');
const excerptCommentContinue=document.getElementById('excerpt-comments-continue');
const excerptCommentClose=document.getElementById('excerpt-comments-close');
const excerptCommentStatus=document.getElementById('excerpt-comment-status');
let excerptComments=[],excerptCommentsBusy=false,excerptCommentNext=0;
function updateExcerptCommentActions(){
  if(!excerptCommentUIReady)return;
  excerptCommentButton.disabled=selectionBusy||excerptCommentsBusy;
  excerptCommentOpen.hidden=!excerptComments.length;excerptCommentOpen.textContent='批注 '+excerptComments.length;
  excerptCommentSend.disabled=excerptCommentsBusy||!selectionDraftAvailable||!excerptComments.length;
  excerptCommentSend.textContent=excerptCommentsBusy?'正在加入…':'加入聊天草稿';
  excerptCommentContinue.disabled=excerptCommentsBusy;excerptCommentClose.disabled=excerptCommentsBusy;
  excerptCommentSend.title=selectionDraftAvailable?'引用和对应评论一起加入当前聊天草稿，尚不发送':'当前窗口没有聊天草稿接口；批注可在此暂存';
  for(const input of excerptCommentList.querySelectorAll('textarea'))input.readOnly=excerptCommentsBusy;
  for(const button of excerptCommentList.querySelectorAll('button'))button.disabled=excerptCommentsBusy;
}
function renderExcerptComments(){
  excerptCommentList.replaceChildren();
  excerptComments.forEach((entry,index)=>{
    const card=document.createElement('section');card.className='excerpt-comment-card';
    const heading=document.createElement('div');heading.className='excerpt-comment-heading';
    const source=document.createElement('strong');source.textContent=(index+1)+'. '+entry.name;source.title=entry.path||entry.name;
    const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.setAttribute('aria-label','移除第 '+(index+1)+' 段批注');
    remove.addEventListener('click',()=>{
      if(excerptCommentsBusy)return;
      excerptComments=excerptComments.filter(item=>item.id!==entry.id);renderExcerptComments();
      (excerptCommentList.querySelector('textarea')||excerptCommentContinue).focus();
    });
    heading.append(source,remove);
    const quote=document.createElement('blockquote');quote.textContent=entry.text;
    const label=document.createElement('label'),input=document.createElement('textarea');
    input.id='excerpt-comment-'+entry.id;input.rows=3;input.maxLength=5000;input.value=entry.comment;
    input.placeholder='对这段选文补充问题或修改要求…';input.setAttribute('aria-label','第 '+(index+1)+' 段评论');
    label.htmlFor=input.id;label.textContent='评论（可选）';
    input.addEventListener('input',()=>{entry.comment=input.value;excerptCommentStatus.textContent='';});
    card.append(heading,quote,label,input);excerptCommentList.append(card);
  });
  if(!excerptComments.length){const empty=document.createElement('p');empty.textContent='还没有批注。关闭此面板，选中文字后点击“评论…”。';excerptCommentList.append(empty);}
  updateExcerptCommentActions();
  if(typeof scheduleExcerptMarkers==='function')scheduleExcerptMarkers();
}
function showExcerptComments(focusLast=false){
  if(excerptCommentsBusy||viewerDisposed)return;
  if(typeof confirmQuickExcerptComment==='function'&&!confirmQuickExcerptComment())return;
  resetSelectedExcerpt();excerptCommentStatus.textContent='';renderExcerptComments();excerptCommentDialog.hidden=false;
  const inputs=excerptCommentList.querySelectorAll('textarea');
  (focusLast?inputs[inputs.length-1]:inputs[0])?.focus();
  if(!inputs.length)excerptCommentContinue.focus();
}
function closeExcerptComments(){
  if(excerptCommentsBusy)return;
  excerptCommentDialog.hidden=true;resetSelectedExcerpt();
  (excerptComments.length?excerptCommentOpen:document.getElementById('directory-toggle')).focus({preventScroll:true});
}
function commentSelectedExcerpt(){
  const entry=selectedExcerpt;
  if(viewerDisposed||selectionBusy||excerptCommentsBusy||!entry||entry.uri!==activeFile?.resourceUri)return;
  if(entry.text.length>20000){excerptNotice('单段批注最多 2 万字，请缩小选区；快捷添加仍支持更长文段。',true);return;}
  // 统一使用插件内批注状态，避免原生请求被接受后绕过本地编号气泡。
  if(excerptComments.length>=20){excerptNotice('一次最多暂存 20 段，请先加入聊天草稿或移除部分批注。',true);return;}
  if(excerptComments.reduce((total,item)=>total+item.text.length+item.comment.length,0)+entry.text.length>100000){excerptNotice('批注总长度超过 10 万字，请分批加入聊天草稿。',true);return;}
  openQuickExcerptComment({text:entry.text,name:entry.name,path:activeFile.path||'',uri:entry.uri,comment:'',range:entry.range});
}
async function sendExcerptComments(){
  if(viewerDisposed||excerptCommentsBusy||!excerptComments.length)return;
  if(!selectionDraftAvailable){excerptCommentStatus.textContent='当前窗口没有聊天草稿接口，请在聊天旁使用。';return;}
  if(typeof confirmQuickExcerptComment==='function'&&!confirmQuickExcerptComment())return;
  const entries=excerptComments.map(item=>({...item}));
  if(entries.some(item=>item.text.length>20000||item.comment.length>5000)||entries.reduce((total,item)=>total+item.text.length+item.comment.length,0)>100000){
    excerptCommentStatus.textContent='批注过长：单条评论最多 5000 字，全部引用和评论合计最多 10 万字。';return;
  }
  excerptCommentsBusy=true;excerptCommentStatus.textContent='';updateExcerptCommentActions();
  try{
    await request('ui/message',{role:'user',content:entries.map((item,index)=>({type:'text',
      text:'文件：'+item.name+(item.path?'\n路径：'+item.path:'')+'\n所选文段 '+(index+1)+'：\n'+item.text+'\n\n我的评论：\n'+(item.comment.trim()||'（未填写）'),
      _meta:{'openai/title':item.name+' · 批注 '+(index+1)}})),_meta:{'openai/message':{target:'active',send:false}}});
    if(viewerDisposed)return;
    excerptComments=[];excerptCommentDialog.hidden=true;renderExcerptComments();
    excerptNotice('引用和对应评论已加入聊天草稿，尚未发送；可在输入框中查看。');
  }catch(error){if(!viewerDisposed)excerptCommentStatus.textContent='加入失败：'+error.message+'。批注仍保留，可重试。';}
  finally{excerptCommentsBusy=false;updateExcerptCommentActions();}
}
excerptCommentButton.addEventListener('pointerdown',event=>event.preventDefault());
excerptCommentButton.addEventListener('click',commentSelectedExcerpt);
excerptCommentOpen.addEventListener('click',()=>showExcerptComments());
excerptCommentContinue.addEventListener('click',closeExcerptComments);excerptCommentClose.addEventListener('click',closeExcerptComments);
excerptCommentSend.addEventListener('click',sendExcerptComments);
excerptCommentDialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeExcerptComments();return;}
  if(event.key==='Tab'){
    const items=[...excerptCommentDialog.querySelectorAll('button,textarea')].filter(item=>!item.disabled&&!item.hidden),index=items.indexOf(document.activeElement);
    if(event.shiftKey&&index<=0){event.preventDefault();items.at(-1)?.focus();}
    else if(!event.shiftKey&&index===items.length-1){event.preventDefault();items[0]?.focus();}
  }
});
window.addEventListener('pagehide',()=>{excerptComments=[];excerptCommentList.replaceChildren();excerptCommentDialog.hidden=true;});
excerptCommentUIReady=true;updateExcerptCommentActions();
