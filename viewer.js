// MCP Apps postMessage protocol; images use the host-supplied document path.
const preview = document.getElementById('preview'), status = document.getElementById('status');
let activeFile = null, anchorFile=null, sourceText = '', nextId = 0, readGeneration = 0, viewerDisposed=false;
let hostFileOpenAvailable = false;
let workspaceSession=null;
const pending = new Map();
function send(message) { window.parent.postMessage({jsonrpc:'2.0',...message}, '*'); }
function request(method, params) {
  if(method==='tools/call'&&typeof workspaceSession!=='undefined'&&workspaceSession&&['read_preview_file','read_markdown_images','list_markdown_directory','save_markdown_file','read_pdf_preview','create_workspace_directory'].includes(params?.name))params={...params,arguments:{...params.arguments,workspaceSession:params.arguments?.workspaceSession||workspaceSession}};
  return new Promise((resolve,reject)=>{
    const id = ++nextId, timeout = setTimeout(()=>{pending.delete(id);reject(new Error('文件预览连接超时，请重新打开此文件标签页。'));},20000);
    pending.set(id,{resolve,reject,timeout});send({id,method,params});
  });
}
function error(message) { status.className='error';status.textContent=message; }
function theme(context) { if(context?.theme)document.documentElement.dataset.theme=context.theme; }
DOMPurify.addHook('uponSanitizeElement',(node,data)=>{
  if(data.tagName==='img'){
    const src=node.getAttribute('src');
    if(src!=null)node.setAttribute('data-md-image-src',src);
    node.removeAttribute('src');node.removeAttribute('srcset');
  }
});
async function loadImages(generation) {
  const images=[...preview.querySelectorAll('img[data-md-image-src]')].filter(image=>!image.previewLoading), entries=new Map();
  for(const image of images){
    image.previewLoading=true;
    const source=image.getAttribute('data-md-image-src');
    const note=document.createElement('span');note.className='image-status';note.textContent='正在加载图片…';
    image.hidden=true;image.after(note);image.decoding='async';
    if(!entries.has(source))entries.set(source,[]);entries.get(source).push({image,note});
  }
  const fail=(source,message)=>{for(const {image,note} of entries.get(source)||[]){image.hidden=true;note.className='image-status image-error';note.textContent='图片加载失败'+(image.alt?'（'+image.alt+'）':'')+'：'+message;}};
  const display=(source,data)=>{for(const {image,note} of entries.get(source)||[]){
    image.onload=()=>{if(generation===readGeneration){image.hidden=false;note.remove();}};
    image.onerror=()=>{if(generation===readGeneration)fail(source,'图片数据无法显示');};
    image.src=data;image.loading='eager';
  }};
  const local=[];
  for(const source of entries.keys()){
    if(/^data:image\/(?:png|jpeg|gif|webp|svg\+xml|bmp|x-icon|avif)[;,]/i.test(source))display(source,source);
    else if(/^(?:https?:|\/\/)/i.test(source))fail(source,'当前预览只读取本地图片');
    else local.push(source);
  }
  for(let index=0;index<local.length;index+=8){
    if(generation!==readGeneration)return;
    const sources=local.slice(index,index+8);
    try {
      const result=await request('tools/call',{name:'read_markdown_images',arguments:{sources,...(activeFile?.path?{documentPath:activeFile.path}:{})}});
      if(generation!==readGeneration)return;
      if(result.isError)throw new Error(result.content?.find(c=>c.type==='text')?.text||'本地图片读取失败');
      const returned=result.structuredContent?.images;
      if(!Array.isArray(returned))throw new Error('查看器没有返回图片，请重新打开应用加载新版插件');
      const received=new Set();
      for(const item of returned){
        if(!sources.includes(item.source))continue;received.add(item.source);
        if(item.error)fail(item.source,item.error);
        else if(item.blob&&/^image\/(?:png|jpeg|gif|webp|svg\+xml|bmp|x-icon|avif)$/.test(item.mimeType))display(item.source,'data:'+item.mimeType+';base64,'+item.blob);
        else fail(item.source,'图片返回数据不完整');
      }
      for(const source of sources)if(!received.has(source))fail(source,'没有收到图片数据');
    }catch(e){if(generation===readGeneration)for(const source of sources)fail(source,e.message);}
  }
}
function render(text,generation,preserveBlocks=false) {
  sourceText=text;document.getElementById('source').textContent=text;
  const clean = html => DOMPurify.sanitize(html,{FORBID_TAGS:['script','style','iframe','object','embed','form','textarea','button'],FORBID_ATTR:['style','id','name'],ALLOW_DATA_ATTR:false,ADD_ATTR:['data-md-image-src'],ADD_URI_SAFE_ATTR:['data-md-image-src']});
  const next=document.createElement('div');next.innerHTML=DOMPurify.sanitize(markdownHtml(text,clean));
  // 编辑只替换发生变化的块，保留其余图片、流程图和异步加载状态。
  const previous=new Map();
  if(preserveBlocks)for(const block of preview.children){const key=block.previewMarkup;if(key!=null){if(!previous.has(key))previous.set(key,[]);previous.get(key).push(block);}}
  const blocks=[...next.children].map(block=>{
    const key=block.innerHTML,existing=previous.get(key)?.shift();
    if(existing){existing.dataset.sourceFrom=block.dataset.sourceFrom;existing.dataset.sourceTo=block.dataset.sourceTo;return existing;}
    block.previewMarkup=key;return block;
  });
  preview.replaceChildren(...blocks);
  if(typeof highlightMarkdownCode==='function')highlightMarkdownCode(preview);
  if(typeof renderMermaidBlocks==='function')renderMermaidBlocks(preview,preserveBlocks);
  rebuildOutline();
  for (const input of preview.querySelectorAll('input')) {input.type='checkbox';input.disabled=true;}
  for (const a of preview.querySelectorAll('a')) {
    const href=a.getAttribute('href')||'';
    if(!href.startsWith('#')&&!a.previewLinkBound){a.previewLinkBound=true;a.addEventListener('click',event=>{
      event.preventDefault();
      if(/^https?:\/\//i.test(href))request('ui/open-link',{url:href}).catch(e=>error(e.message));
    });}
  }
  loadImages(generation);
}
function clearFileNavigationSelection(){
  const editing=document.activeElement;
  if(editing&&(['INPUT','TEXTAREA'].includes(editing.tagName)||editing.isContentEditable))return;
  window.getSelection?.()?.removeAllRanges();
}
async function previewPath(path,preserveDirectory=true){
  if(!anchorFile||viewerDisposed)return;
  if(typeof confirmEditorNavigation==='function'&&!await confirmEditorNavigation())return;
  if(viewerDisposed)return;
  clearFileNavigationSelection();
  const generation=++readGeneration;
  resetSelectedExcerpt();clearOutline();pictureSurface.clear();
  if(typeof clearFormatSurfaces==='function')clearFormatSurfaces();
  preview.hidden=true;preview.replaceChildren();
  document.getElementById('source').hidden=true;document.getElementById('source').textContent='';
  document.getElementById('picture-view').hidden=true;
  status.className='';status.textContent='正在读取文件…';
  try{
    const result=await request('tools/call',{name:'read_preview_file',arguments:path?{path}:{}});
    if(generation!==readGeneration)return;
    if(result.isError)throw new Error(result.content?.find(item=>item.type==='text')?.text||'文件无法读取');
    const data=result.structuredContent;
    if(!data?.path||!['markdown','image','text','pdf'].includes(data.kind))throw new Error('未收到可预览的文件内容');
    activeFile={name:data.name,path:data.path,kind:data.kind,revision:data.revision,resourceUri:anchorFile.resourceUri+'#preview='+encodeURIComponent(data.path)};
    document.getElementById('title').textContent=data.name;
    const markdown=data.kind==='markdown';
    document.getElementById('size').disabled=!markdown;
    document.getElementById('outline-toggle').hidden=!(markdown||data.kind==='pdf');

    if(!markdown&&data.kind!=='pdf'&&navigationMode==='outline')setDirectoryVisible(true,'files');
    if(data.kind==='pdf'){await pdfSurface.show(data);if(generation!==readGeneration)return;}
    else if(data.kind==='image'){document.getElementById('picture-view').hidden=false;pictureSurface.show(data,data.name);}
    else if(markdown){preview.hidden=false;render(data.text,generation);}
    else{sourceText=data.text;if(typeof showTextFile==='function')showTextFile(data);else{document.getElementById('source').textContent=data.text;document.getElementById('source').hidden=false;}}
    if(typeof syncEditorControls==='function')syncEditorControls();
    syncDocumentNavigation(activeFile,preserveDirectory);
    document.getElementById('document-area')?.scrollTo?.({top:0,behavior:'instant'});
    status.className='';status.textContent='';
    if(typeof launcherFileOpened==='function')launcherFileOpened();
    return true;
  }catch(e){if(generation===readGeneration){
    const detail=/Unknown tool|unknown tool|not found/i.test(e.message)?'插件服务尚未更新，请在插件设置中重新启用此插件，或重启应用。':e.message;
    error('读取失败：'+detail);
  }}
}
async function loadFile(file){
  if(!file?.resourceUri||viewerDisposed)return;
  if(typeof confirmEditorNavigation==='function'&&!await confirmEditorNavigation())return;
  cancelPendingFilePreview();anchorFile=file;activeFile=null;
  document.getElementById('title').textContent=file.name||'file-workspace';
  return await previewPath(null,false);
}
function teardownViewer(){
  if(typeof cancelWorkspacePicker==='function')cancelWorkspacePicker();
  if(viewerDisposed)return;viewerDisposed=true;++readGeneration;
  if(typeof clearFormatSurfaces==='function')clearFormatSurfaces();
  if(typeof persistEditorDraft==='function')persistEditorDraft();
  cancelPendingFilePreview();resetSelectedExcerpt();clearOutline();pictureSurface.clear();
  if(typeof disposeDirectoryTree==='function')disposeDirectoryTree();
  for(const waiter of pending.values()){clearTimeout(waiter.timeout);waiter.reject(new Error('预览页已关闭'));}pending.clear();
}
window.addEventListener('pagehide',teardownViewer);
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;
  const message=event.data;
  if(message.id!=null&&!message.method){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);clearTimeout(waiter.timeout);message.error?waiter.reject(new Error(message.error.message)):waiter.resolve(message.result);}return;}
  if(message.method==='ui/notifications/tool-input'&&message.params?.arguments?.file){workspaceSession=null;loadFile(message.params.arguments.file);}
  if(message.method==='ui/notifications/tool-result'&&!activeFile&&message.params?.structuredContent?.file){workspaceSession=null;loadFile(message.params.structuredContent.file);}
  if(message.method==='ui/notifications/host-context-changed')theme(message.params);
  if(message.method==='notifications/resources/updated'&&message.params?.uri===anchorFile?.resourceUri){
    if(typeof editorSession!=='undefined'&&editorSession)editorNotice('原文件可能已更新，编辑内容已保留；保存前会检查版本。');
    else previewPath(activeFile?.path);
  }
  if(message.id!=null){if(['ping','ui/resource-teardown'].includes(message.method)){if(message.method==='ui/resource-teardown')teardownViewer();send({id:message.id,result:{}});}else send({id:message.id,error:{code:-32601,message:'Method not found'}});}
});
document.getElementById('size').addEventListener('change',event=>preview.style.fontSize=event.target.value+'px');preview.style.fontSize='16px';
document.getElementById('refresh').addEventListener('click',()=>{cancelPendingFilePreview();previewPath(activeFile?.path);});
request('ui/initialize',{appInfo:{name:'markdown-math-preview',version:'1.8.1'},appCapabilities:{},protocolVersion:'2025-11-21'})
  .then(result=>{if(viewerDisposed)return;hostFileOpenAvailable=!!result.hostCapabilities?.experimental?.['openai/files'];setSelectionHostCapabilities(result.hostCapabilities);theme(result.hostContext);send({method:'ui/notifications/initialized'});status.textContent=activeFile?'':'请选择文件。';launcherConnected=true;syncPickerButtons();setTimeout(showLauncherHome,350);})
  .catch(e=>{if(!viewerDisposed)error(e.message);});
