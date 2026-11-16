// 从已完成安全清理的正文提取大纲，不重复解析 Markdown，不读取其他文件。
const outlineList=document.getElementById('outline-list');
const outlineMessage=document.getElementById('outline-message');
let outlineEntries=[],outlineActive=null,outlineFrame=null;
function clearOutline(){
  if(outlineFrame!==null){window.cancelAnimationFrame(outlineFrame);outlineFrame=null;}
  outlineEntries=[];outlineActive=null;outlineList.replaceChildren();
  outlineMessage.textContent='正在读取文章…';
}
function outlineLabel(heading){
  const copy=heading.cloneNode(true);
  for(const math of copy.querySelectorAll('.katex')){
    const tex=math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if(tex)math.replaceWith(document.createTextNode(tex));
  }
  return copy.textContent.replace(/\s+/g,' ').trim()||'未命名标题';
}
function rebuildOutline(){
  clearOutline();
  const stack=[],roots=[];
  for(const heading of preview.querySelectorAll('h1,h2,h3,h4,h5,h6')){
    const level=Number(heading.tagName.slice(1));
    const entry={heading,level,label:outlineLabel(heading),children:[],button:null,details:null};
    while(stack.length&&stack.at(-1).level>=level)stack.pop();
    (stack.length?stack.at(-1).children:roots).push(entry);stack.push(entry);outlineEntries.push(entry);
  }
  function appendEntries(entries,parent){
    for(const entry of entries){
      const item=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='outline-link';button.textContent=entry.label;button.title=entry.label;
      button.addEventListener('click',event=>{event.preventDefault();jumpToOutline(entry);});entry.button=button;
      if(entry.children.length){
        const details=document.createElement('details'),summary=document.createElement('summary'),children=document.createElement('ul');
        details.open=true;summary.append(button);details.append(summary,children);entry.details=details;
        item.append(details);appendEntries(entry.children,children);
      }else item.append(button);
      parent.append(item);
    }
  }
  appendEntries(roots,outlineList);
  outlineMessage.textContent=outlineEntries.length?'':'文章中没有标题，暂时没有可跳转的目录。';
  updateOutlineCurrent();
}
function markOutlineCurrent(entry){
  if(outlineActive===entry)return;
  outlineActive?.button?.removeAttribute('aria-current');
  outlineActive=entry;entry?.button?.setAttribute('aria-current','location');
}
function updateOutlineCurrent(){
  if(preview.hidden||!outlineEntries.length)return;
  let current=outlineEntries[0];
  for(const entry of outlineEntries){if(entry.heading.getBoundingClientRect().top<=76)current=entry;else break;}
  markOutlineCurrent(current);
}
function scheduleOutlineCurrent(){
  if(directoryPanel.hidden||navigationMode!=='outline'||outlineFrame!==null)return;
  outlineFrame=window.requestAnimationFrame(()=>{outlineFrame=null;updateOutlineCurrent();});
}
function jumpToOutline(entry){
  if(typeof editorSession!=='undefined'&&editorSession&&(displayMode==='source'||activeBlock)){
    const label=entry.label,level=entry.level;closeActiveBlock();displayMode='edit';renderEditorPreview();syncEditorControls();
    entry=outlineEntries.find(item=>item.label===label&&item.level===level)||outlineEntries[0];if(!entry)return;
  }
  resetSelectedExcerpt();
  preview.hidden=false;document.getElementById('source').hidden=true;

  // 导航栏与正文并排，跳转时保持目录展开。
  entry.heading.scrollIntoView({behavior:'auto',block:'start'});
  entry.heading.setAttribute('tabindex','-1');entry.heading.focus({preventScroll:true});
  markOutlineCurrent(entry);
}
document.getElementById('outline-toggle').addEventListener('click',()=>{
  setDirectoryVisible(directoryPanel.hidden||navigationMode!=='outline','outline');updateOutlineCurrent();
});
document.getElementById('outline-expand').addEventListener('click',()=>{for(const entry of outlineEntries)if(entry.details)entry.details.open=true;});
document.getElementById('outline-collapse').addEventListener('click',()=>{for(const entry of outlineEntries)if(entry.details)entry.details.open=false;});
window.addEventListener('scroll',scheduleOutlineCurrent,{passive:true});
document.getElementById('document-area')?.addEventListener('scroll',scheduleOutlineCurrent,{passive:true});
window.addEventListener('resize',scheduleOutlineCurrent);
