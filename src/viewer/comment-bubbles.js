// 气泡和高亮位于独立图层，不向 Markdown 正文插入 span，避免影响段落编辑区间。
var excerptMarkersReady=false;
const quickComment=document.getElementById('excerpt-quick-editor'),quickCommentInput=document.getElementById('excerpt-quick-input');
const quickCommentError=document.getElementById('excerpt-quick-error'),commentMarkers=document.getElementById('excerpt-markers');
let quickCommentDraft=null,excerptMarkerFrame=null;
function excerptRangeRoot(range){
  if(!range)return null;
  return [preview,document.getElementById('source')].find(root=>root&&!root.hidden&&root.contains(range.startContainer)&&root.contains(range.endContainer))||null;
}
function commentTextIndex(){
  const root=[preview,document.getElementById('source')].find(el=>el&&!el.hidden);
  if(!root)return null;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let text='',node;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('textarea,button,script,style,[hidden],.katex-mathml'))continue;
    nodes.push({node,start:text.length});text+=node.textContent;
    if(text.length>2000000)return null;
  }
  return {root,nodes,text};
}
function rangeForExcerptComment(entry,index){
  if(entry.uri!==activeFile?.resourceUri)return null;
  try{if(excerptRangeRoot(entry.range)&&entry.range.toString().trim()===(entry.rangeText??entry.text).trim())return entry.range;}catch{}
  if(!index)return null;
  const anchorText=entry.rangeText??entry.text;
  const start=index.text.indexOf(anchorText);
  // 同一段文字在文档中出现多次时不猜位置，仍可从“批注 N”查看原始引用。
  if(start<0||index.text.indexOf(anchorText,start+1)>=0)return null;
  const end=start+anchorText.length;
  const first=index.nodes.find(item=>item.start+item.node.textContent.length>start);
  const last=index.nodes.find(item=>item.start+item.node.textContent.length>=end);
  if(!first||!last)return null;
  const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);
  if(range.toString().trim()!==anchorText.trim())return null;
  entry.range=range;return range;
}
function visibleCommentRect(range){
  if(!excerptRangeRoot(range))return null;
  const area=document.getElementById('document-area').getBoundingClientRect();
  return [...range.getClientRects()].find(rect=>rect.width>0&&rect.height>0&&rect.bottom>area.top&&rect.top<area.bottom&&rect.right>area.left&&rect.left<area.right)||null;
}
function scheduleExcerptMarkers(){
  if(!excerptMarkersReady||viewerDisposed||excerptMarkerFrame!==null)return;
  excerptMarkerFrame=requestAnimationFrame(()=>{excerptMarkerFrame=null;refreshExcerptMarkers();});
}
function refreshExcerptMarkers(){
  if(!excerptMarkersReady||viewerDisposed)return;
  commentMarkers.replaceChildren();
  for(const entry of excerptComments)if(entry.uri!==activeFile?.resourceUri)entry.range=null;
  const visible=excerptComments.filter(entry=>entry.uri===activeFile?.resourceUri);
  let index=null;
  if(visible.some(entry=>{try{return !excerptRangeRoot(entry.range)||entry.range.toString().trim()!==(entry.rangeText??entry.text).trim();}catch{return true;}}))index=commentTextIndex();
  const area=document.getElementById('document-area').getBoundingClientRect(),ranges=[],positions=[];
  for(const entry of visible){
    const range=rangeForExcerptComment(entry,index);if(!range)continue;
    ranges.push(range);const rect=visibleCommentRect(range);if(!rect)continue;
    const root=excerptRangeRoot(range),edge=root.getBoundingClientRect();
    const x=Math.max(area.left+4,Math.min(area.right-28,edge.right-22));
    let y=Math.max(area.top+4,rect.top-19);
    while(positions.some(point=>Math.abs(point.x-x)<24&&Math.abs(point.y-y)<24))y+=25;
    if(y>area.bottom-24)continue;positions.push({x,y});
    const number=excerptComments.indexOf(entry)+1,button=document.createElement('button');
    button.type='button';button.className='excerpt-comment-bubble';button.textContent=String(number);
    button.setAttribute('aria-label','编辑第 '+number+' 段批注');button.title=entry.comment||'添加可选评论';
    button.style.left=x+'px';button.style.top=y+'px';
    button.addEventListener('pointerdown',event=>event.preventDefault());
    button.addEventListener('click',()=>{if(!excerptCommentsBusy)openQuickExcerptComment(entry,true);});
    commentMarkers.append(button);
  }
  if(globalThis.CSS?.highlights&&typeof Highlight==='function'){
    if(ranges.length)CSS.highlights.set('file-workspace-comments',new Highlight(...ranges));
    else CSS.highlights.delete('file-workspace-comments');
  }
  if(quickCommentDraft&&!quickComment.hidden)positionQuickExcerptComment();
}
function sizeQuickExcerptComment(){
  quickCommentInput.style.height='auto';quickCommentInput.style.height=Math.min(120,Math.max(30,quickCommentInput.scrollHeight))+'px';
}
function positionQuickExcerptComment(){
  if(!quickCommentDraft)return;
  const range=rangeForExcerptComment(quickCommentDraft,null);
  const rect=range&&visibleCommentRect(range)||document.getElementById('excerpt-comments-open').getBoundingClientRect();
  const width=quickComment.offsetWidth,height=quickComment.offsetHeight;
  const x=Math.max(8,Math.min(window.innerWidth-width-8,rect.left));
  const above=rect.top-height-8,below=rect.bottom+8;
  const y=above>=52?above:below;
  quickComment.style.left=x+'px';quickComment.style.top=Math.max(52,Math.min(window.innerHeight-height-8,y))+'px';
}
function openQuickExcerptComment(entry,existing=false){
  if(viewerDisposed||excerptCommentsBusy)return;
  if(quickCommentDraft&&!confirmQuickExcerptComment())return;
  let range;try{range=entry.range?.cloneRange();}catch{}
  const rangeText=range?.toString()||entry.rangeText||entry.text;
  quickCommentDraft={...entry,range:range||entry.range,rangeText,comment:entry.comment||'',existingId:existing?entry.id:null};
  resetSelectedExcerpt();quickCommentError.textContent='';quickCommentInput.value=quickCommentDraft.comment;
  quickComment.hidden=false;sizeQuickExcerptComment();positionQuickExcerptComment();quickCommentInput.focus();
}
function cancelQuickExcerptComment(){
  quickCommentDraft=null;quickComment.hidden=true;quickCommentError.textContent='';resetSelectedExcerpt();
}
function confirmQuickExcerptComment(){
  if(!quickCommentDraft)return true;
  if(excerptCommentsBusy)return false;
  const draft=quickCommentDraft,comment=quickCommentInput.value;
  const previous=excerptComments.find(item=>item.id===draft.existingId);
  if(comment.length>5000||excerptComments.reduce((total,item)=>total+(item===previous?0:item.text.length+item.comment.length),0)+draft.text.length+comment.length>100000){
    quickCommentError.textContent='评论最多 5000 字，批注合计最多 10 万字。';return false;
  }
  if(previous)previous.comment=comment;
  else{
    if(excerptComments.length>=20){quickCommentError.textContent='最多暂存 20 段，请先加入聊天草稿。';return false;}
    const {existingId,...entry}=draft;excerptComments.push({...entry,id:++excerptCommentNext,comment});
  }
  cancelQuickExcerptComment();window.getSelection?.()?.removeAllRanges();
  renderExcerptComments();refreshExcerptMarkers();scheduleExcerptMarkers();return true;
}
document.getElementById('excerpt-quick-confirm').addEventListener('click',confirmQuickExcerptComment);
document.getElementById('excerpt-quick-cancel').addEventListener('click',cancelQuickExcerptComment);
quickCommentInput.addEventListener('input',()=>{sizeQuickExcerptComment();positionQuickExcerptComment();quickCommentError.textContent='';});
quickComment.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelQuickExcerptComment();return;}
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();confirmQuickExcerptComment();}
});
document.addEventListener('pointerdown',event=>{
  if(quickCommentDraft&&!quickComment.contains(event.target)&&!commentMarkers.contains(event.target))confirmQuickExcerptComment();
},true);
document.addEventListener('scroll',scheduleExcerptMarkers,true);window.addEventListener('resize',scheduleExcerptMarkers);
const excerptMarkerObserver=new MutationObserver(scheduleExcerptMarkers);
excerptMarkerObserver.observe(document.getElementById('document-area'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style']});
const excerptMarkerResize=new ResizeObserver(scheduleExcerptMarkers);excerptMarkerResize.observe(document.getElementById('document-area'));
window.addEventListener('pagehide',()=>{
  excerptMarkersReady=false;excerptMarkerObserver.disconnect();excerptMarkerResize.disconnect();
  if(excerptMarkerFrame!==null)cancelAnimationFrame(excerptMarkerFrame);
  quickCommentDraft=null;quickComment.hidden=true;commentMarkers.replaceChildren();globalThis.CSS?.highlights?.delete('file-workspace-comments');
});
excerptMarkersReady=true;scheduleExcerptMarkers();
