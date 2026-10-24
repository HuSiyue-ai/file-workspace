// PDF pages are rasterized locally. Navigation never opens an external browser.
const pdfSurface=(()=>{
  const panel=document.getElementById('pdf-view'),image=document.getElementById('pdf-image'),paper=document.getElementById('pdf-paper'),stage=document.getElementById('pdf-stage'),notice=document.getElementById('pdf-message');
  let doc=null,page=1,epoch=0,paint=0,searchEpoch=0,zoom='fit-width',query='',searching=false,resizeTimer=null,lastWidth=0;
  const el=id=>document.getElementById(id);
  function clear(){
    ++epoch;++paint;++searchEpoch;doc=null;searching=false;clearTimeout(resizeTimer);resizeTimer=null;panel.hidden=true;image.removeAttribute('src');image.hidden=true;
    el('pdf-highlights').replaceChildren();el('pdf-results').replaceChildren();el('pdf-results').hidden=true;el('pdf-search-status').textContent='';notice.textContent='';el('pdf-search-button').textContent='搜索';
  }
  function unpack(result){if(result.isError)throw new Error(result.content?.find(x=>x.type==='text')?.text||'PDF 读取失败');return result.structuredContent||{};}
  async function call(action,args={}){
    if(!doc)throw new Error('PDF 已关闭');
    return unpack(await request('tools/call',{name:'read_pdf_preview',arguments:{path:doc.path,revision:doc.revision,action,...args}}));
  }
  function cssScale(){return zoom==='fit-width'?Math.max(.05,(stage.clientWidth-24)/Math.max(1,doc?.pageWidth||600)):Number(zoom);}
  function sizePaper(){if(doc){paper.style.width=Math.max(20,Math.floor(doc.pageWidth*cssScale()))+'px';paper.style.aspectRatio=doc.pageWidth+' / '+doc.pageHeight;}}
  function controls(busy=false){
    el('pdf-prev').disabled=busy||!doc||page<=1;el('pdf-next').disabled=busy||!doc||page>=doc.pageCount;el('pdf-page').disabled=busy||!doc;
    el('pdf-page').value=String(page);el('pdf-page-count').textContent='/ '+(doc?.pageCount||'—');el('pdf-zoom').value=zoom;
  }
  function updateBookmark(){
    let current=null;for(const entry of outlineEntries)if(entry.pdfPage<=page)current=entry;
    if(current)markOutlineCurrent(current);
  }
  function buildOutline(items){
    clearOutline();const stack=[];
    for(const item of items||[]){
      const li=document.createElement('li'),button=document.createElement('button'),children=document.createElement('ul'),details=document.createElement('details'),summary=document.createElement('summary');
      const level=Math.max(1,Math.min(12,Number(item.level)||1));while(stack.length&&stack.at(-1).level>=level)stack.pop();
      const parent=stack.at(-1);(parent?parent.children:outlineList).append(li);
      if(parent&&!parent.hasChildren){parent.hasChildren=true;parent.li.replaceChildren(parent.details);parent.summary.append(parent.button);parent.details.append(parent.summary,parent.children);parent.entry.details=parent.details;}
      button.type='button';button.className='outline-link';button.textContent=item.title||'未命名书签';button.title='第 '+item.page+' 页';button.addEventListener('click',()=>renderPage(item.page));li.append(button);details.open=true;
      const entry={button,details:null,pdfPage:item.page};outlineEntries.push(entry);stack.push({level,li,button,children,details,summary,entry,hasChildren:false});
    }
    outlineMessage.textContent=outlineEntries.length?'':'这个 PDF 没有内置书签。';updateBookmark();
  }
  async function renderPage(number=page){
    if(!doc)return;number=Math.max(1,Math.min(doc.pageCount,Number(number)||1));
    const currentEpoch=epoch,ticket=++paint;page=number;controls(true);sizePaper();image.hidden=true;el('pdf-highlights').replaceChildren();notice.textContent='正在渲染第 '+page+' 页…';notice.classList.remove('error');
    try{
      const data=await call('page',{page,scale:Math.max(.2,Math.min(4,cssScale()*(window.devicePixelRatio||1))),query});
      if(currentEpoch!==epoch||ticket!==paint)return;
      if(!data.blob||!['image/png','image/jpeg'].includes(data.mimeType))throw new Error('未收到 PDF 页面图像');
      doc.pageWidth=data.pageWidth;doc.pageHeight=data.pageHeight;sizePaper();
      image.src='data:'+data.mimeType+';base64,'+data.blob;image.alt='PDF 第 '+page+' 页';image.hidden=false;
      el('pdf-highlights').replaceChildren();for(const box of data.boxes||[]){
        if(box.length!==4||!box.every(Number.isFinite))continue;const mark=document.createElement('span');mark.style.left=(box[0]*100)+'%';mark.style.top=(box[1]*100)+'%';mark.style.width=(box[2]*100)+'%';mark.style.height=(box[3]*100)+'%';el('pdf-highlights').append(mark);
      }
      notice.textContent='';stage.scrollTop=0;updateBookmark();
    }catch(e){if(currentEpoch===epoch&&ticket===paint){notice.textContent=e.message;notice.classList.add('error');}}
    finally{if(currentEpoch===epoch&&ticket===paint)controls(false);}
  }
  async function show(data){
    clear();doc={...data};page=1;zoom='fit-width';query='';panel.hidden=false;el('pdf-page').max=String(doc.pageCount);el('pdf-search').value='';buildOutline(doc.outline);controls();await renderPage(1);
  }
  async function search(){
    if(!doc)return;
    if(searching){++searchEpoch;searching=false;el('pdf-search-button').textContent='搜索';el('pdf-search-status').textContent='已停止搜索。';return;}
    query=el('pdf-search').value.trim();el('pdf-results').replaceChildren();el('pdf-results').hidden=true;
    if(!query){el('pdf-search-status').textContent='请输入要查找的文字。';await renderPage();return;}
    const token=++searchEpoch,currentEpoch=epoch;searching=true;el('pdf-search-button').textContent='停止';let start=1,count=0,total=0,first=null;
    try{
      while(start&&doc&&currentEpoch===epoch&&token===searchEpoch){
        const data=await call('search',{page:start,query});if(currentEpoch!==epoch||token!==searchEpoch)return;
        for(const match of data.matches||[]){
          if(count>=200)break;const option=document.createElement('option');option.value=String(match.page);option.textContent='第 '+match.page+' 页 · '+match.count+' 处';el('pdf-results').append(option);count++;total+=match.count;if(first===null)first=match.page;
        }
        el('pdf-results').hidden=!count;el('pdf-search-status').textContent='已查找 '+data.scanned+' / '+doc.pageCount+' 页，找到 '+total+' 处';
        if(count>=200){el('pdf-search-status').textContent+='（仅列出前 200 个命中页）';break;}start=data.nextPage;
      }
      if(!count)el('pdf-search-status').textContent='没有找到文字。扫描图片型 PDF 暂不支持 OCR 搜索。';
      if(first!==null&&currentEpoch===epoch&&token===searchEpoch)await renderPage(first);
    }catch(e){if(currentEpoch===epoch&&token===searchEpoch)el('pdf-search-status').textContent='搜索失败：'+e.message;}
    finally{if(currentEpoch===epoch&&token===searchEpoch){searching=false;el('pdf-search-button').textContent='搜索';}}
  }
  el('pdf-prev').addEventListener('click',()=>renderPage(page-1));el('pdf-next').addEventListener('click',()=>renderPage(page+1));
  el('pdf-page').addEventListener('change',event=>renderPage(event.target.value));
  el('pdf-page').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();renderPage(event.target.value);}});
  el('pdf-zoom').addEventListener('change',event=>{zoom=event.target.value;renderPage();});
  el('pdf-search-form').addEventListener('submit',event=>{event.preventDefault();search();});el('pdf-results').addEventListener('change',event=>renderPage(Number(event.target.value)));
  image.addEventListener('error',()=>{if(doc){notice.textContent='页面图像无法显示，请刷新重试。';notice.classList.add('error');}});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{
    const width=entries[0]?.contentRect.width;if(!doc||zoom!=='fit-width'||!width||Math.abs(width-lastWidth)<2)return;lastWidth=width;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(doc)renderPage();},220);
  }).observe(stage);
  return {clear,show};
})();
