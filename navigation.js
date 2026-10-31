// 目录始终在分栏中；文件夹按需展开，单击文件不触发宿主导航。
const directoryPanel=document.getElementById('directory-panel');
const directoryToggle=document.getElementById('directory-toggle');
const directoryList=document.getElementById('directory-list');
const directoryMessage=document.getElementById('directory-message');
let directoryData=null,directoryRoot=null,directoryGeneration=0,directoryDocumentUri=null;
let navigationMode='files',filePreviewTimer=null,folderToggleTimer=null,locateGeneration=0,directoryRootRequest=0;
const folderClickDelay=320;
const directoryNodes=new Map();
const directoryMore=document.getElementById('directory-more'),directoryMenu=document.getElementById('directory-menu');
function directoryMenuItems(){return ['directory-up','directory-collapse','directory-new-folder'].map(id=>document.getElementById(id)).filter(item=>item&&!item.disabled);}
function setDirectoryMenuVisible(visible,focus=true,last=false){
  if(visible)cancelPendingFilePreview();
  visible=visible&&!directoryPanel.hidden&&navigationMode==='files';directoryMenu.hidden=!visible;
  directoryMore.setAttribute('aria-expanded',String(visible));
  if(focus)(visible?(last?directoryMenuItems().at(-1):directoryMenuItems()[0]):directoryMore)?.focus();
}
function updateDirectoryHeading(){
  const files=navigationMode==='files';
  document.getElementById('navigation-heading').hidden=files;
  document.getElementById('directory-path').hidden=!files;document.getElementById('directory-tools').hidden=!files;
  const address=document.getElementById('directory-path');address.title=directoryRoot?.path||'';
  document.getElementById('directory-root-name').textContent=directoryRoot?pathName(directoryRoot.path):'文件夹';
}
const pathKey=value=>String(value||'').replace(/\\/g,'/').replace(/\/+$/,'').toLocaleLowerCase();
const pathName=value=>String(value).replace(/[\\/]+$/,'').split(/[\\/]/).pop()||value;
function cancelPendingFilePreview(){if(filePreviewTimer!==null){clearTimeout(filePreviewTimer);filePreviewTimer=null;}if(folderToggleTimer!==null){clearTimeout(folderToggleTimer);folderToggleTimer=null;}}
function directoryNotice(message,isError=false){directoryMessage.textContent=message;directoryMessage.classList.toggle('error',isError);}
function markDirectoryCurrent(){
  const selected=pathKey(activeFile?.path||directoryData?.documentPath);
  for(const node of directoryNodes.values()){
    if(!node.button)continue;
    const current=node.kind==='file'&&pathKey(node.path)===selected;
    if(current)node.button.setAttribute('aria-current','page');else node.button.removeAttribute('aria-current');
    node.element.setAttribute('aria-selected',String(current));
  }
}
function setDirectoryVisible(visible,mode=navigationMode){
  if(typeof closeFileActions==='function')closeFileActions();
  cancelPendingFilePreview();setDirectoryMenuVisible(false,false);if(typeof setProjectRootMenuVisible==='function')setProjectRootMenuVisible(false,false);
  if(!visible){endDirectoryResize();cancelPendingFilePreview();}
  navigationMode=mode==='outline'?'outline':'files';directoryPanel.hidden=!visible;
  directoryToggle.setAttribute('aria-expanded',String(visible&&navigationMode==='files'));
  document.getElementById('outline-toggle').setAttribute('aria-expanded',String(visible&&navigationMode==='outline'));
  document.getElementById('directory-view').hidden=navigationMode!=='files';
  document.getElementById('outline-view').hidden=navigationMode!=='outline';
  const label=navigationMode==='outline'?'大纲':'文件树';
  document.getElementById('navigation-heading').textContent=label;directoryPanel.setAttribute('aria-label',label);updateDirectoryHeading();
  document.body.classList.toggle('directory-open',visible);
  if(visible&&navigationMode==='files'&&!directoryData&&!directoryRoot)loadDirectory();
  if(!visible)(navigationMode==='outline'?document.getElementById('outline-toggle'):directoryToggle).focus();
}
function syncDocumentNavigation(file,preserve=false){
  if(preserve&&directoryRoot){directoryDocumentUri=file.resourceUri;if(directoryData)directoryData.documentPath=file.path;markDirectoryCurrent();return;}
  if(directoryDocumentUri===file.resourceUri)return;
  directoryDocumentUri=file.resourceUri;directoryData=null;directoryRoot=null;++directoryGeneration;++locateGeneration;++directoryRootRequest;
  directoryNodes.clear();directoryList.replaceChildren();
  if(!directoryPanel.hidden&&navigationMode==='files')loadDirectory();
}
function makeDirectoryNode(entry,parent){
  const node={...entry,parent,expanded:false,effectiveExpanded:false,loaded:false,loading:false,children:[],sequence:0,error:null,truncated:false};
  directoryNodes.set(pathKey(node.path),node);return node;
}
function forgetDirectoryNode(node){for(const child of node.children)forgetDirectoryNode(child);++node.sequence;directoryNodes.delete(pathKey(node.path));}
function reconcileDirectory(node,data){
  const existing=new Map(node.children.map(child=>[pathKey(child.path),child]));
  const valid=data.entries.filter(entry=>entry&&typeof entry.name==='string'&&typeof entry.path==='string'&&['file','directory'].includes(entry.kind));
  node.children=valid.map(entry=>{
    const key=pathKey(entry.path),previous=existing.get(key);existing.delete(key);
    if(previous&&previous.kind===entry.kind){previous.name=entry.name;return previous;}
    if(previous)forgetDirectoryNode(previous);return makeDirectoryNode(entry,node);
  });
  for(const child of existing.values())forgetDirectoryNode(child);
  node.loaded=true;node.loading=false;node.error=null;node.truncated=!!data.truncated;
}
function renderDirectoryNode(node){
  if(node.element)return node.element;
  const item=document.createElement('li'),button=document.createElement('button');
  item.setAttribute('role','treeitem');item.setAttribute('aria-selected','false');item.className='directory-item';
  button.type='button';button.className='directory-entry';button.title=node.path;button.setAttribute('data-path',node.path);
  const arrow=document.createElement('span');arrow.className='directory-arrow';arrow.setAttribute('aria-hidden','true');
  arrow.textContent=node.kind==='directory'?'›':'';
  const icon=document.createElement('span');icon.className='directory-icon';icon.setAttribute('aria-hidden','true');icon.textContent=node.kind==='directory'?'📁':'📄';
  if(typeof decorateDirectoryFileIcon==='function')decorateDirectoryFileIcon(icon,node);
  const label=document.createElement('span');label.className='directory-name';label.textContent=node.name;
  button.append(arrow,icon,label);item.append(button);node.element=item;node.button=button;node.icon=icon;node.arrow=arrow;
  button.addEventListener('keydown',event=>directoryKeydown(event,node));
  button.addEventListener('contextmenu',event=>{if(typeof showFileActions==='function')showFileActions(event,node);});
  button.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){if(typeof showFileActions==='function')showFileActions(event,node);}});
  if(node.kind==='directory'){
    const group=document.createElement('ul');group.className='directory-children';group.setAttribute('role','group');group.hidden=true;
    node.group=group;item.append(group);
    button.title=node.path+'\n单击：展开/收起；双击：进入此文件夹';
    button.addEventListener('click',event=>{
      cancelPendingFilePreview();if(event.detail>1)return;
      if(!event.detail){setFolderExpanded(node,!node.expanded);return;}
      const epoch=directoryGeneration;
      folderToggleTimer=setTimeout(()=>{
        folderToggleTimer=null;
        if(epoch===directoryGeneration&&directoryNodes.get(pathKey(node.path))===node)setFolderExpanded(node,!node.expanded);
      },folderClickDelay);
    });
    button.addEventListener('dblclick',event=>{event.preventDefault();return enterDirectory(node);});
  }else{
    button.title=node.path+'\n单击：当前页预览；双击：交给应用打开';
    button.addEventListener('click',event=>{
      cancelPendingFilePreview();if(event.detail>1)return;
      filePreviewTimer=setTimeout(()=>{filePreviewTimer=null;previewPath(node.path);},250);
    });
    button.addEventListener('dblclick',event=>{event.preventDefault();openDirectoryFile(node);});
  }
  return item;
}
function updateDirectoryNode(node){
  if(!node.element)return;
  if(node.kind==='directory'){
    node.button.setAttribute('aria-expanded',String(node.effectiveExpanded));node.element.setAttribute('aria-expanded',String(node.effectiveExpanded));
    node.arrow.classList.toggle('expanded',node.effectiveExpanded);node.icon.textContent=node.effectiveExpanded?'📂':'📁';node.group.hidden=!node.effectiveExpanded;
    node.button.setAttribute('aria-busy',String(node.loading));
  }
}
function renderDirectoryChildren(node){
  const container=node===directoryRoot?directoryList:node.group;
  if(!container)return;
  const items=node.children.map(child=>renderDirectoryNode(child));
  if(node.loading||node.error||node.truncated||(node.loaded&&!node.children.length)){
    const note=document.createElement('li');note.className='directory-note';note.setAttribute('role','none');
    const text=document.createElement('span');text.setAttribute('role','status');
    text.textContent=node.loading?'正在加载…':node.error?'读取失败，收起后可重新展开。':node.truncated?'仅显示前 500 项。':'文件夹为空。';
    note.append(text);items.push(note);
  }
  container.replaceChildren(...items);
}
function renderDirectory(){
  if(!directoryRoot)return;
  const query=document.getElementById('directory-filter').value.trim().toLocaleLowerCase();
  function matches(node){node.selfMatches=!!query&&node.name.toLocaleLowerCase().includes(query);node.descendantMatches=node.children.map(matches).some(Boolean);return node.selfMatches||node.descendantMatches;}
  for(const node of directoryRoot.children)matches(node);
  function apply(node,ancestorMatches=false){
    node.element.hidden=!!query&&!ancestorMatches&&!node.selfMatches&&!node.descendantMatches;
    node.effectiveExpanded=node.expanded||!!query&&node.descendantMatches;updateDirectoryNode(node);
    for(const child of node.children)apply(child,ancestorMatches||node.selfMatches);
  }
  for(const node of directoryRoot.children)apply(node);
  markDirectoryCurrent();
  const visible=directoryRoot.children.some(node=>!node.element.hidden);
  const messages=[];
  if(query&&!visible)messages.push('已加载的目录中没有匹配项。');
  else if(!query&&!directoryRoot.children.length&&directoryRoot.loaded)messages.push('这个文件夹为空。');
  if(directoryRoot.truncated)messages.push('根目录仅显示前 500 项。');
  directoryNotice(messages.join(' '));
}
async function directoryRequest(path){
  const response=await request('tools/call',{name:'list_markdown_directory',arguments:{...(path?{directory:path}:{}),...(activeFile?.path?{documentPath:activeFile.path}:{})}});
  if(response.isError)throw new Error(response.content?.find(item=>item.type==='text')?.text||'无法读取文件夹');
  const data=response.structuredContent;
  if(!data||typeof data.directory!=='string'||!Array.isArray(data.entries))throw new Error('未收到目录内容，请重新打开文件标签页。');
  return data;
}
async function loadDirectory(path){
  if(typeof closeFileActions==='function')closeFileActions();
  cancelPendingFilePreview();if(!activeFile&&!(typeof anchorFile!=='undefined'&&anchorFile?.kind==='directory')){directoryNotice('尚未取得项目路径，请从项目菜单选择文件夹。');return false;}
  const operation=++directoryRootRequest;++locateGeneration;
  // 先读取，成功后再替换：打不开的文件夹不清空当前文件树。
  directoryList.setAttribute('aria-busy','true');directoryNotice('正在打开文件夹…');
  try{
    const data=await directoryRequest(path);if(operation!==directoryRootRequest)return false;
    ++directoryGeneration;directoryNodes.clear();
    directoryRoot=makeDirectoryNode({path:data.directory,name:pathName(data.directory),kind:'directory'},null);directoryRoot.expanded=true;
    directoryData=data;document.getElementById('directory-filter').value='';
    reconcileDirectory(directoryRoot,data);renderDirectoryChildren(directoryRoot);renderDirectory();
    directoryList.scrollTop=0;updateDirectoryHeading();
    document.getElementById('directory-up-quick').disabled=document.getElementById('directory-up').disabled=!data.parent;return true;
  }catch(error){if(operation===directoryRootRequest)directoryNotice(error.message,true);return false;}
  finally{if(operation===directoryRootRequest)directoryList.setAttribute('aria-busy','false');}
}
async function enterDirectory(node){
  cancelPendingFilePreview();
  if(node.kind!=='directory'||directoryNodes.get(pathKey(node.path))!==node)return false;
  return loadDirectory(node.path);
}
async function navigateDirectoryUp(){
  cancelPendingFilePreview();if(!directoryData?.parent)return false;
  const parent=directoryData.parent,previous=directoryRoot?.path;
  if(!await loadDirectory(parent))return false;
  // 只回到真实父目录，不使用“定位当前文档”改变导航根目录。
  const target=directoryNodes.get(pathKey(previous));
  if(target?.button){target.button.scrollIntoView({block:'nearest',inline:'nearest'});target.button.focus({preventScroll:true});}
  return true;
}
async function loadDirectoryNode(node,force=false){
  if(node.loading&&!force)return node.inflight;
  const epoch=directoryGeneration,sequence=++node.sequence;
  node.loading=true;node.error=null;renderDirectoryChildren(node);updateDirectoryNode(node);
  node.inflight=(async()=>{
    try{
      const data=await directoryRequest(node.path);
      if(epoch!==directoryGeneration||sequence!==node.sequence||directoryNodes.get(pathKey(node.path))!==node)return;
      reconcileDirectory(node,data);
      if(node===directoryRoot){directoryData=data;document.getElementById('directory-up-quick').disabled=document.getElementById('directory-up').disabled=!data.parent;}
      renderDirectoryChildren(node);renderDirectory();
    }catch(error){
      if(epoch!==directoryGeneration||sequence!==node.sequence)return;
      node.loading=false;node.error=error.message;renderDirectoryChildren(node);updateDirectoryNode(node);
      directoryNotice('文件夹读取失败：'+error.message,true);
    }
  })();
  return node.inflight;
}
async function setFolderExpanded(node,expanded){
  cancelPendingFilePreview();node.expanded=expanded;renderDirectory();
  if(expanded&&!node.loaded)await loadDirectoryNode(node);
}
async function openDirectoryFile(node){
  cancelPendingFilePreview();
  if(!hostFileOpenAvailable){directoryNotice('当前窗口不支持另开文件，单击仍可在本页预览。',true);return;}
  if(node.opening)return;node.opening=true;node.button.disabled=true;
  try{await request('openai/files/open',{path:node.path});directoryNotice('已交给应用打开：'+node.name);}
  catch(error){directoryNotice('打开失败：'+error.message,true);}
  finally{node.opening=false;if(node.button.isConnected)node.button.disabled=false;}
}
function visibleDirectoryNodes(){
  const result=[];
  function walk(node){if(node.element.hidden)return;result.push(node);if(node.effectiveExpanded)for(const child of node.children)walk(child);}
  if(directoryRoot)for(const node of directoryRoot.children)walk(node);return result;
}
function directoryKeydown(event,node){
  const visible=visibleDirectoryNodes(),index=visible.indexOf(node);let focus=null;
  if(event.key==='ArrowDown')focus=visible[Math.min(visible.length-1,index+1)];
  else if(event.key==='ArrowUp')focus=visible[Math.max(0,index-1)];
  else if(event.key==='Home')focus=visible[0];else if(event.key==='End')focus=visible.at(-1);
  else if(event.key==='ArrowRight'&&node.kind==='directory'){
    if(!node.effectiveExpanded)setFolderExpanded(node,true);else focus=node.children.find(child=>!child.element.hidden);
  }else if(event.key==='ArrowLeft'){
    if(node.kind==='directory'&&node.effectiveExpanded)setFolderExpanded(node,false);
    else if(node.parent!==directoryRoot)focus=node.parent;
  }else return;
  event.preventDefault();focus?.button?.focus();
}
async function locateCurrentFile(){
  cancelPendingFilePreview();document.getElementById('directory-filter').value='';
  if(!activeFile?.path)return;const path=activeFile.path;
  const inside=()=>directoryRoot&&(pathKey(path).startsWith(pathKey(directoryRoot.path)+'/'));
  if(!inside())await loadDirectory(path.replace(/[\\/][^\\/]+$/,'')||'/');
  if(!directoryRoot)return;
  const generation=++locateGeneration,epoch=directoryGeneration;
  const relative=path.replace(/\\/g,'/').slice(directoryRoot.path.replace(/\\/g,'/').replace(/\/+$/,'').length).replace(/^\/+/,'');
  let node=directoryRoot;
  for(const part of relative.split('/').slice(0,-1)){
    if(generation!==locateGeneration||epoch!==directoryGeneration||pathKey(activeFile?.path)!==pathKey(path))return;
    const child=node.children.find(item=>item.kind==='directory'&&item.name.toLocaleLowerCase()===part.toLocaleLowerCase());
    if(!child){directoryNotice('当前文件未出现在已加载的目录中。',true);return;}
    await setFolderExpanded(child,true);node=child;
  }
  if(generation!==locateGeneration||epoch!==directoryGeneration||pathKey(activeFile?.path)!==pathKey(path))return;
  renderDirectory();const target=directoryNodes.get(pathKey(path));
  if(target?.button){target.button.scrollIntoView({block:'nearest',inline:'nearest'});target.button.focus({preventScroll:true});}
}
async function refreshDirectoryTree(){
  if(typeof retryWorkspaceHome==='function'&&!anchorFile){await retryWorkspaceHome();return;}
  if(!directoryRoot){await loadDirectory();return;}
  const epoch=directoryGeneration;await loadDirectoryNode(directoryRoot,true);
  async function refreshExpanded(node){
    for(const child of [...node.children])if(child.kind==='directory'&&child.expanded){
      if(epoch!==directoryGeneration)return;await loadDirectoryNode(child,true);await refreshExpanded(child);
    }
  }
  if(epoch===directoryGeneration)await refreshExpanded(directoryRoot);
}
// 使用菜单的标准键盘操作；Escape 先收起菜单，不关闭整个目录栏。
directoryMore.addEventListener('click',()=>setDirectoryMenuVisible(directoryMenu.hidden));
directoryMore.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp'].includes(event.key))return;
  event.preventDefault();setDirectoryMenuVisible(true,true,event.key==='ArrowUp');
});
directoryMenu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDirectoryMenuVisible(false);return;}
  const items=directoryMenuItems(),index=items.indexOf(document.activeElement);let next;
  if(event.key==='ArrowDown')next=items[(index+1)%items.length];
  else if(event.key==='ArrowUp')next=items[(index-1+items.length)%items.length];
  else if(event.key==='Home')next=items[0];else if(event.key==='End')next=items.at(-1);else return;
  event.preventDefault();next?.focus();
});
for(const type of ['pointerdown','focusin'])document.addEventListener(type,event=>{
  if(!directoryMenu.hidden&&!directoryMenu.contains(event.target)&&!directoryMore.contains(event.target))setDirectoryMenuVisible(false,false);
},true);
for(const item of ['directory-up','directory-collapse'])document.getElementById(item).addEventListener('click',()=>setDirectoryMenuVisible(false));

directoryToggle.addEventListener('click',()=>setDirectoryVisible(directoryPanel.hidden||navigationMode!=='files','files'));
document.getElementById('directory-close').addEventListener('click',()=>setDirectoryVisible(false));
document.getElementById('directory-home').addEventListener('click',locateCurrentFile);
document.getElementById('directory-up').addEventListener('click',navigateDirectoryUp);
document.getElementById('directory-up-quick').addEventListener('click',navigateDirectoryUp);
document.getElementById('directory-refresh').addEventListener('click',refreshDirectoryTree);
document.getElementById('directory-collapse').addEventListener('click',()=>{cancelPendingFilePreview();for(const node of directoryNodes.values())if(node!==directoryRoot)node.expanded=false;document.getElementById('directory-filter').value='';renderDirectory();});
document.getElementById('directory-filter').addEventListener('input',()=>{cancelPendingFilePreview();renderDirectory();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!directoryPanel.hidden){event.preventDefault();setDirectoryVisible(false);}});
function disposeDirectoryTree(){
  if(typeof closeFileActions==='function')closeFileActions();setDirectoryMenuVisible(false,false);cancelPendingFilePreview();++directoryGeneration;++locateGeneration;++directoryRootRequest;directoryNodes.clear();endDirectoryResize();}
window.addEventListener('pagehide',disposeDirectoryTree);

// 真正分栏：为正文预留空间，窄窗口也不切换成覆盖式侧栏。
const directoryResize=document.getElementById('directory-resize');
let directoryWidth=300,preferredDirectoryWidth=300,directoryDrag=null;
function directoryWidthLimits(){
  const viewport=Math.max(1,window.innerWidth),reserve=Math.min(240,Math.max(120,viewport*.35));
  const maximum=Math.max(1,Math.min(640,viewport-reserve));return{minimum:Math.min(180,maximum),maximum};
}
function applyDirectoryWidth(value,remember=true){
  if(remember)preferredDirectoryWidth=value;const {minimum,maximum}=directoryWidthLimits();
  directoryWidth=Math.round(Math.max(minimum,Math.min(maximum,value)));
  document.documentElement.style.setProperty('--directory-width',directoryWidth+'px');
  directoryResize.setAttribute('aria-valuemin',String(minimum));directoryResize.setAttribute('aria-valuemax',String(maximum));
  directoryResize.setAttribute('aria-valuenow',String(directoryWidth));directoryResize.setAttribute('aria-valuetext',directoryWidth+' 像素');
}
function endDirectoryResize(){const drag=directoryDrag;directoryDrag=null;document.body.classList.toggle('directory-resizing',false);if(drag&&directoryResize.hasPointerCapture(drag.id))directoryResize.releasePointerCapture(drag.id);}
directoryResize.addEventListener('pointerdown',event=>{if(event.button!==0||directoryPanel.hidden||directoryDrag)return;event.preventDefault();directoryResize.focus();directoryResize.setPointerCapture(event.pointerId);directoryDrag={id:event.pointerId,x:event.clientX,width:directoryWidth};document.body.classList.toggle('directory-resizing',true);});
directoryResize.addEventListener('pointermove',event=>{if(directoryDrag?.id!==event.pointerId)return;applyDirectoryWidth(directoryDrag.width+directoryDrag.x-event.clientX);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])directoryResize.addEventListener(type,event=>{if(directoryDrag?.id===event.pointerId)endDirectoryResize();});
directoryResize.addEventListener('keydown',event=>{const {minimum,maximum}=directoryWidthLimits();const next={ArrowLeft:directoryWidth+16,ArrowRight:directoryWidth-16,Home:minimum,End:maximum}[event.key];if(next===undefined)return;event.preventDefault();applyDirectoryWidth(next);});
window.addEventListener('resize',()=>{setDirectoryMenuVisible(false,false);endDirectoryResize();applyDirectoryWidth(preferredDirectoryWidth,false);});
window.addEventListener('blur',()=>{setDirectoryMenuVisible(false,false);endDirectoryResize();});applyDirectoryWidth(directoryWidth);
