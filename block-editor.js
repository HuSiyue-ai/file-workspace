// 阅读锁定；编辑只展开一个原始 Markdown 区间；源码共用同一份草稿。
const editorInput=document.getElementById('markdown-editor'),editMode=document.getElementById('document-mode');
let editorSession=null,editorTransition=null,editorDecision=null,displayMode='read',activeBlock=null;
function editorDirty(){return !!editorSession&&editorSession.text!==editorSession.base;}
function editorNotice(text,isError=false){const el=document.getElementById('edit-status');el.textContent=text;el.classList.toggle('error',isError);el.hidden=!text;}
function draftKey(path){return 'file-preview:markdown-draft:'+path;}
function persistEditorDraft(){
  if(!editorSession)return;
  try{if(editorDirty())localStorage.setItem(draftKey(editorSession.path),JSON.stringify({text:editorSession.text,revision:editorSession.revision}));else localStorage.removeItem(draftKey(editorSession.path));}
  catch{editorNotice('草稿缓存不可用，请及时保存；关闭标签可能丢失未保存修改。',true);}
}
function removeEditorDraft(path){try{localStorage.removeItem(draftKey(path));}catch{}}
function sourceBlocks(){return [...preview.children].filter(el=>el.classList.contains('markdown-block'));}
function blockRange(block){return{from:Number(block.dataset.sourceFrom),to:Number(block.dataset.sourceTo)};}
function configureEditableBlocks(){
  const editable=displayMode==='edit';preview.classList.toggle('block-edit-mode',editable);
  if(editable&&editorSession?.text===''&&!preview.children.length){const block=document.createElement('div');block.className='markdown-block empty-edit-block';block.dataset.sourceFrom='0';block.dataset.sourceTo='0';preview.append(block);}
  for(const block of sourceBlocks())if(editable){block.tabIndex=0;block.setAttribute('aria-label','编辑此段落');}else{block.removeAttribute('tabindex');block.removeAttribute('aria-label');}
}
function renderEditorPreview(){
  if(!editorSession)return;const area=document.getElementById('document-area'),top=area.scrollTop;
  render(editorSession.text,readGeneration,true);sourceText=editorSession.base;document.getElementById('source').textContent=sourceText;
  configureEditableBlocks();area.scrollTop=top;
}
function syncEditorControls(){
  const markdown=activeFile?.kind==='markdown',saving=!!editorSession?.saving;
  editMode.hidden=!markdown;editMode.value=displayMode;editMode.disabled=!markdown||saving;
  for(const option of editMode.options)option.disabled=option.value!=='read'&&!activeFile?.revision;
  editMode.title=activeFile?.revision?'阅读锁定；编辑点击段落；源码编辑整篇':'后台保存服务未加载，请完整退出应用后重开';
  const source=!!editorSession&&displayMode==='source';document.getElementById('editor-pane').hidden=!source;
  if(markdown){preview.hidden=source;document.getElementById('source').hidden=true;}
  document.getElementById('document-area').classList.toggle('editing',source);
  document.getElementById('document-area').classList.toggle('inline-editing',displayMode==='edit');
  editorInput.readOnly=saving;if(activeBlock)activeBlock.input.readOnly=saving;
  document.getElementById('editor-save').hidden=!editorDirty()&&!saving;document.getElementById('editor-save').disabled=saving||!editorDirty();
  document.getElementById('edit-dirty').textContent=saving?'保存中…':editorDirty()?'● 未保存':'';document.getElementById('edit-dirty').hidden=!saving&&!editorDirty();
  configureEditableBlocks();
}
function stopEditor(){activeBlock?.releaseLayout?.();activeBlock=null;editorSession=null;displayMode='read';preview.style.minHeight='';editorInput.value='';editorNotice('');syncEditorControls();}
function beginEditor(){
  if(activeFile?.kind!=='markdown'||!activeFile.revision)return false;if(editorSession)return true;
  const base=sourceText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');editorSession={path:activeFile.path,base,text:base,revision:activeFile.revision,saving:false,history:new MarkdownEditHistory()};
  try{const saved=JSON.parse(localStorage.getItem(draftKey(activeFile.path))||'null');
    if(saved&&typeof saved.text==='string'&&typeof saved.revision==='string'){editorSession.text=saved.text;editorSession.revision=saved.revision;editorNotice(saved.revision===activeFile.revision?'已恢复未保存草稿。':'已恢复草稿，但原文件已变化。请复制修改后刷新、手工合并。',saved.revision!==activeFile.revision);}
  }catch{editorNotice('草稿缓存不可用，请及时保存。',true);}return true;
}
function editorPosition(){return activeBlock?{from:activeBlock.from,caret:activeBlock.input.selectionStart}:displayMode==='source'?{from:null,caret:editorInput.selectionStart}:null;}
function updateEditorText(text,key,position){
  if(!editorSession||editorSession.saving||text===editorSession.text)return;
  editorSession.history.record(editorSession.text,key,position);editorSession.text=text;syncEditorControls();persistEditorDraft();
}
function findPreviewBlock(target){let el=target?.nodeType===1?target:target?.parentElement;while(el&&el.parentElement!==preview)el=el.parentElement;return el?.parentElement===preview&&el.classList.contains('markdown-block')?el:null;}
function autoSizeBlock(input){const area=document.getElementById('document-area'),top=area.scrollTop;input.style.height='0px';input.style.height=Math.max(72,input.scrollHeight+3)+'px';area.scrollTop=top;}
function captureEditorView(from=null){
  const area=document.getElementById('document-area'),edge=area.getBoundingClientRect().top;
  const block=sourceBlocks().find(el=>from!=null?blockRange(el).from===from:el.getBoundingClientRect().bottom>edge);
  return {from:block?blockRange(block).from:null,y:block?.getBoundingClientRect().top,top:area.scrollTop,left:area.scrollLeft};
}
function reserveEditorScroll(top){
  const area=document.getElementById('document-area');
  if(displayMode==='edit'&&top>area.scrollTop)preview.style.minHeight=Math.max(preview.getBoundingClientRect().height,top+area.clientHeight)+'px';
}
function restoreEditorView(view){
  const area=document.getElementById('document-area'),block=sourceBlocks().find(el=>blockRange(el).from===view.from);
  const top=block&&Number.isFinite(view.y)?area.scrollTop+block.getBoundingClientRect().top-view.y:view.top;
  reserveEditorScroll(top);area.scrollTop=top;area.scrollLeft=view.left;
}
function closeActiveBlock(anchorFrom=null){
  if(!activeBlock)return;const view=captureEditorView(anchorFrom),current=activeBlock;current.releaseLayout?.();activeBlock=null;
  // 原始节点原位归还；未修改的块无需重建，异步图像也不重新加载。
  current.element.replaceChildren(...current.originalNodes);current.element.classList.remove('active-source-block');current.element.style.minHeight='';
  if(current.input.value!==current.originalText)renderEditorPreview();else configureEditableBlocks();
  for(const host of current.element.querySelectorAll('.mermaid-inline'))host.resumeMermaid?.();
  restoreEditorView(view);
}
function sourceCaretAtPoint(block,event){
  const source=editorSession.text.slice(blockRange(block).from,blockRange(block).to);
  let point;
  try{const caret=document.caretPositionFromPoint?.(event.clientX,event.clientY);if(caret)point={node:caret.offsetNode,offset:caret.offset};
    else{const range=document.caretRangeFromPoint?.(event.clientX,event.clientY);if(range)point={node:range.startContainer,offset:range.startOffset};}}catch{}
  if(!point||point.node.nodeType!==3||!block.contains(point.node))return null;
  const nodeText=point.node.textContent||'',prefix=document.createRange();prefix.selectNodeContents(block);prefix.setEnd(point.node,point.offset);
  const renderedOffset=prefix.toString().length,renderedLength=Math.max(1,block.textContent.length),estimate=source.length*renderedOffset/renderedLength;
  // 高亮代码由多个 span 构成，使用整段 code 的真实文本偏移。
  const code=point.node.parentElement?.closest('pre>code');
  if(code&&block.contains(code)){const start=source.indexOf(code.textContent);if(start>=0){prefix.selectNodeContents(code);prefix.setEnd(point.node,point.offset);return start+prefix.toString().length;}}
  let best=-1,distance=Infinity;
  if(nodeText)for(let index=source.indexOf(nodeText);index>=0;index=source.indexOf(nodeText,index+1)){
    const value=index+Math.min(point.offset,nodeText.length),delta=Math.abs(value-estimate);if(delta<distance){best=value;distance=delta;}
  }
  return best>=0?best:null;
}
function textareaCaretPoint(input,caret){
  const style=getComputedStyle(input),mirror=document.createElement('div'),marker=document.createElement('span'),box=input.getBoundingClientRect();
  mirror.style.cssText='position:fixed;visibility:hidden;pointer-events:none;overflow-wrap:break-word;white-space:pre-wrap;';
  for(const name of ['boxSizing','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle'])mirror.style[name]=style[name];
  mirror.style.width=box.width+'px';mirror.style.left=box.left+'px';mirror.style.top=box.top+'px';
  mirror.append(document.createTextNode(input.value.slice(0,caret)));marker.textContent='\u200b';mirror.append(marker,document.createTextNode(input.value.slice(caret)||'\u200b'));document.body.append(mirror);
  const rect=marker.getBoundingClientRect(),point={x:rect.left,y:rect.top+rect.height/2};mirror.remove();return point;
}
function guardActiveBlockLayout(current){
  if(typeof ResizeObserver==='undefined')return;
  const area=document.getElementById('document-area');let top=current.element.getBoundingClientRect().top;
  const remember=()=>{top=current.element.getBoundingClientRect().top;};
  const observer=new ResizeObserver(()=>{
    if(activeBlock!==current||!current.element.isConnected)return;
    const delta=current.element.getBoundingClientRect().top-top;
    if(Math.abs(delta)>.5){const target=area.scrollTop+delta;reserveEditorScroll(target);area.scrollTop=target;}
    remember();
  });
  observer.observe(preview);area.addEventListener('scroll',remember,{passive:true});
  current.releaseLayout=()=>{observer.disconnect();area.removeEventListener('scroll',remember);};
}
function openBlockAt(from,caret=0,clickPoint=null){
  if(displayMode!=='edit'||!editorSession||editorSession.saving)return;
  const block=sourceBlocks().find(el=>{const r=blockRange(el);return r.from===from||(r.from<=from&&from<r.to);});if(!block)return;const range=blockRange(block);
  if(!Number.isInteger(range.from)||!Number.isInteger(range.to)||range.to>editorSession.text.length)return;
  const view=captureEditorView(range.from),height=block.getBoundingClientRect().height,originalNodes=[...block.childNodes];
  resetSelectedExcerpt();const input=document.createElement('textarea');input.id='block-editor';input.className='block-source-editor';input.spellcheck=false;input.setAttribute('aria-label','当前段落 Markdown');
  input.value=editorSession.text.slice(range.from,range.to);input.setAttribute('rows','2');block.style.minHeight=height+'px';block.classList.add('active-source-block');block.replaceChildren(input);block.removeAttribute('tabindex');
  const current={element:block,input,from:range.from,to:range.to,originalNodes,originalText:input.value};activeBlock=current;
  input.addEventListener('input',()=>{
    if(activeBlock!==current||editorSession?.saving)return;
    try{const before=current.to,text=replaceMarkdownRange(editorSession.text,current.from,current.to,input.value);
      updateEditorText(text,'block:'+current.from,{from:current.from,caret:input.selectionStart});current.to=current.from+input.value.length;const delta=current.to-before;
      for(const following of sourceBlocks())if(following!==block){const r=blockRange(following);if(r.from>=before){following.dataset.sourceFrom=r.from+delta;following.dataset.sourceTo=r.to+delta;}}
      block.dataset.sourceTo=current.to;autoSizeBlock(input);
    }catch(e){editorNotice(e.message,true);}
  });
  input.addEventListener('blur',()=>setTimeout(()=>{if(activeBlock===current&&document.activeElement!==input)closeActiveBlock();},0));
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();const position=current.from;closeActiveBlock();sourceBlocks().find(el=>blockRange(el).from===position)?.focus({preventScroll:true});}});
  autoSizeBlock(input);const position=Math.max(0,Math.min(caret,input.value.length));input.setSelectionRange(position,position);input.focus({preventScroll:true});
  restoreEditorView(view);
  if(clickPoint){const area=document.getElementById('document-area'),point=textareaCaretPoint(input,position),top=area.scrollTop+point.y-clickPoint.y;reserveEditorScroll(top);area.scrollTop=top;}
  guardActiveBlockLayout(current);
}
let blockPointerHandled=false;
function handleBlockClick(event){
  if(blockPointerHandled){blockPointerHandled=false;return;}
  if(displayMode!=='edit'||editorSession?.saving||event.target.closest?.('a,input,button,textarea,select'))return;
  if(window.getSelection?.()?.isCollapsed===false)return;const block=findPreviewBlock(event.target);if(!block||activeBlock?.element===block)return;
  const from=blockRange(block).from,caret=sourceCaretAtPoint(block,event);closeActiveBlock(from);openBlockAt(from,caret??0,caret==null?null:{y:event.clientY});
}
preview.addEventListener('click',handleBlockClick);
preview.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.classList?.contains('markdown-block')){event.preventDefault();openBlockAt(blockRange(event.target).from);}});
document.addEventListener('pointerdown',event=>{
  blockPointerHandled=false;
  if(displayMode!=='edit'||editorSession?.saving||event.button!==0||activeBlock?.element.contains(event.target))return;
  const block=findPreviewBlock(event.target),interactive=event.target.closest?.('a,input,button,textarea,select,summary,.mermaid-tools');
  if(block&&!interactive){
    // 在布局或 blur 改变 DOM 之前固定目标和源码光标；消费本次 click，避免落到移动后的另一个块。
    const from=blockRange(block).from,caret=sourceCaretAtPoint(block,event);blockPointerHandled=true;event.preventDefault();
    closeActiveBlock(from);openBlockAt(from,caret??0,caret==null?null:{y:event.clientY});
  }else if(activeBlock)closeActiveBlock();
},true);
async function changeDocumentMode(mode){
  if(!['read','edit','source'].includes(mode)||editorSession?.saving)return;closeActiveBlock();resetSelectedExcerpt();
  if(mode!=='read'&&!beginEditor()){editorNotice('后台仍为旧服务，请完整退出应用后重新打开。',true);editMode.value=displayMode;return;}
  displayMode=mode;if(mode!=='edit')preview.style.minHeight='';if(editorSession){editorInput.value=editorSession.text;if(mode!=='source')renderEditorPreview();}
  syncEditorControls();if(mode==='source')editorInput.focus();
}
editMode.addEventListener('change',()=>changeDocumentMode(editMode.value));
editorInput.addEventListener('input',()=>updateEditorText(editorInput.value,'source',{from:null,caret:editorInput.selectionStart}));
function editorUndo(direction){
  if(!editorSession||editorSession.saving)return;const result=editorSession.history.step(direction,editorSession.text,editorPosition());if(!result)return;
  activeBlock?.releaseLayout?.();activeBlock=null;editorSession.text=result.text;editorInput.value=result.text;persistEditorDraft();if(displayMode!=='source')renderEditorPreview();syncEditorControls();
  if(displayMode==='edit'&&result.position?.from!=null)openBlockAt(result.position.from,result.position.caret);
  else if(displayMode==='source'){editorInput.focus();const caret=Math.min(result.position?.caret||0,result.text.length);editorInput.setSelectionRange(caret,caret);}
}
async function saveEditor(){
  closeActiveBlock();const session=editorSession;if(!session||session.saving)return false;if(!editorDirty())return true;
  session.saving=true;syncEditorControls();editorNotice('正在检查版本并保存…');
  try{const result=await request('tools/call',{name:'save_markdown_file',arguments:{path:session.path,text:session.text,revision:session.revision}});
    if(result.isError)throw new Error(result.content?.find(item=>item.type==='text')?.text||'保存失败');const data=result.structuredContent;
    if(!data?.saved||data.path!==session.path||typeof data.revision!=='string')throw new Error('未收到可靠的保存结果，草稿仍保留。');if(editorSession!==session)return false;
    session.base=session.text;session.revision=data.revision;activeFile.revision=data.revision;sourceText=session.text;document.getElementById('source').textContent=sourceText;removeEditorDraft(session.path);
    editorNotice('已保存'+(data.backupPath?'，原文件已备份。':'。'));if(displayMode!=='source')renderEditorPreview();return true;
  }catch(e){editorNotice('未保存：'+(/Unknown tool|unknown tool|not found/i.test(e.message)?'保存服务尚未更新，请先保留草稿，完整退出应用后重开。':e.message),true);persistEditorDraft();return false;}
  finally{session.saving=false;if(editorSession===session)syncEditorControls();}
}
function askEditorDecision(){if(editorDecision)return editorDecision.promise;let resolve;const promise=new Promise(done=>resolve=done);editorDecision={promise,resolve};document.getElementById('edit-confirm').hidden=false;document.getElementById('edit-stay').focus();return promise;}
function finishEditorDecision(choice){if(!editorDecision)return;const {resolve}=editorDecision;editorDecision=null;document.getElementById('edit-confirm').hidden=true;resolve(choice);}
async function confirmEditorNavigation(){
  closeActiveBlock();if(!editorSession)return true;if(editorSession.saving){editorNotice('正在保存，请稍后再切换。');return false;}if(editorTransition)return false;
  editorTransition=(async()=>{if(editorDirty()){const choice=await askEditorDecision();if(choice==='stay')return false;if(choice==='save'&&!await saveEditor())return false;if(choice==='discard')removeEditorDraft(editorSession.path);}stopEditor();return true;})();
  try{return await editorTransition;}finally{editorTransition=null;}
}
document.getElementById('editor-save').addEventListener('click',saveEditor);
for(const [id,choice] of [['edit-stay','stay'],['edit-discard','discard'],['edit-save-leave','save']])document.getElementById(id).addEventListener('click',()=>finishEditorDecision(choice));
document.getElementById('edit-confirm').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishEditorDecision('stay');}
  if(event.key==='Tab'){const buttons=[...document.getElementById('edit-confirm').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
});
document.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||!editorSession||event.isComposing)return;const key=event.key.toLowerCase();if(key==='s'){event.preventDefault();saveEditor();}if(key==='z'||key==='y'){const editing=document.activeElement;if(editing&&['INPUT','TEXTAREA'].includes(editing.tagName)&&editing!==editorInput&&editing!==activeBlock?.input)return;event.preventDefault();editorUndo(key==='y'||event.shiftKey?'redo':'undo');}});
window.addEventListener('beforeunload',event=>{persistEditorDraft();if(editorDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',persistEditorDraft);
