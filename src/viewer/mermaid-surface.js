// 离线、按块渲染 Mermaid；保留 Markdown 顶层块与源码偏移，渲染结果作为独立 SVG 图片。
let mermaidRenderEpoch=0,mermaidDiagramId=0,mermaidQueue=Promise.resolve();
if(typeof mermaid!=='undefined')mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,
  maxTextSize:20000,maxEdges:200,htmlLabels:false,theme:'default',fontFamily:'Arial, Microsoft YaHei, sans-serif',
  flowchart:{htmlLabels:false,useMaxWidth:false},
  secure:['secure','securityLevel','startOnLoad','suppressErrorRendering','maxTextSize','maxEdges','htmlLabels','fontFamily','themeCSS','themeVariables']});
function mermaidSourceProblem(source,count,remaining){
  if(count>20)return '一篇文档最多预览 20 张流程图，其余保留源码。';
  if(source.length>20000||source.length>remaining)return '流程图过大，单图最多 2 万字符、全文合计最多 10 万字符。';
  if(/^\s*---/.test(source)||/%%\s*\{/.test(source))return '暂不应用图内配置指令，请移除配置头后预览；源码仍保留。';
  return null;
}
function cleanMermaidSvg(svg){
  if(typeof svg!=='string'||svg.length>2000000)throw new Error('流程图输出过大');
  const safe=DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['script','foreignObject','image','a']});
  const xml=new DOMParser().parseFromString(safe,'image/svg+xml'),root=xml.documentElement;
  if(root.localName!=='svg'||xml.querySelector('parsererror'))throw new Error('未收到有效的 SVG 流程图');
  for(const el of root.querySelectorAll('*'))for(const attr of [...el.attributes]){
    if(/^on/i.test(attr.name)||(/(?:^|:)href$/i.test(attr.name)&&!attr.value.startsWith('#')))el.removeAttribute(attr.name);
  }
  const dimensions=(root.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number),width=dimensions[2];
  const height=dimensions[3];
  return {svg:new XMLSerializer().serializeToString(root),width:Number.isFinite(width)&&width>0?Math.min(width,10000):900,
    height:Number.isFinite(height)&&height>0?Math.min(height,20000):600};
}
function setupInlineMermaid(host,stage,image,tools,width,height){
  let zoom=1,fit=1,offsetX=0,offsetY=0,drag=null,disposed=false;
  const minus=document.createElement('button'),value=document.createElement('span'),plus=document.createElement('button'),reset=document.createElement('button');
  for(const [button,label,text] of [[minus,'缩小流程图','−'],[plus,'放大流程图','+'],[reset,'重置流程图缩放','↺']]){button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.title=label;}
  value.className='mermaid-zoom-value';tools.append(minus,value,plus,reset);stage.tabIndex=0;stage.setAttribute('aria-label','流程图；Ctrl 加滚轮缩放，放大后拖动，0 恢复');
  function paint(){
    const bounds=stage.getBoundingClientRect(),scaledW=width*fit*zoom,scaledH=height*fit*zoom;
    const maxX=Math.max(0,(scaledW-bounds.width)/2),maxY=Math.max(0,(scaledH-bounds.height)/2);
    offsetX=Math.max(-maxX,Math.min(maxX,offsetX));offsetY=Math.max(-maxY,Math.min(maxY,offsetY));
    image.style.width=width*fit+'px';image.style.height=height*fit+'px';
    image.style.transform='translate('+offsetX+'px,'+offsetY+'px) scale('+zoom+')';
    stage.classList.toggle('diagram-zoomed',zoom>1);value.textContent=Math.round(zoom*100)+'%';minus.disabled=zoom<=.5;plus.disabled=zoom>=5;
  }
  function resize(){fit=Math.min(1,Math.max(1,host.clientWidth)/width,Math.max(180,Math.min(480,window.innerHeight*.6))/height);stage.style.height=Math.max(1,height*fit)+'px';paint();}
  function scale(next){zoom=Math.max(.5,Math.min(5,next));if(zoom===1){offsetX=0;offsetY=0;}paint();}
  minus.addEventListener('click',()=>scale(zoom/1.25));plus.addEventListener('click',()=>scale(zoom*1.25));reset.addEventListener('click',()=>scale(1));
  stage.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();scale(zoom*Math.exp(-event.deltaY*.003));},{passive:false});
  stage.addEventListener('keydown',event=>{if(event.target!==stage)return;let next;if(['+','='].includes(event.key))next=zoom*1.25;else if(event.key==='-')next=zoom/1.25;else if(['0','Escape'].includes(event.key))next=1;else return;event.preventDefault();event.stopPropagation();scale(next);});
  stage.addEventListener('pointerdown',event=>{if(zoom<=1||event.button!==0||event.defaultPrevented||typeof displayMode!=='undefined'&&displayMode==='edit')return;
    event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,offsetX,offsetY};stage.setPointerCapture?.(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;offsetX=drag.offsetX+event.clientX-drag.x;offsetY=drag.offsetY+event.clientY-drag.y;paint();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,()=>drag=null);
  resize();
  if(typeof ResizeObserver!=='undefined'){
    // 移除的图不遗留 observer；编辑时原位归还节点则继续沿用缩放状态。
    const observer=new ResizeObserver(()=>{if(!disposed)resize();});
    const cleanup=new MutationObserver(()=>{if(!host.isConnected){disposed=true;observer.disconnect();cleanup.disconnect();window.removeEventListener('resize',resize);}});
    host.resumeMermaid=()=>{disposed=false;observer.observe(host);cleanup.observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',resize);resize();};host.resumeMermaid();
  }
}
function renderMermaidBlocks(root,preserveBlocks=false){
  const epoch=preserveBlocks?mermaidRenderEpoch:++mermaidRenderEpoch;let count=0,remaining=100000;
  // 已渲染的图也计入总量上限，编辑重用不能绕过限制。
  for(const item of root.querySelectorAll('pre.mermaid-block')){count++;remaining-=item.mermaidSourceLength||0;}
  for(const code of root.querySelectorAll('pre>code.language-mermaid')){
    const pre=code.parentElement,source=code.textContent;const number=++count;
    const problem=mermaidSourceProblem(source,count,remaining);remaining-=source.length;
    pre.classList.add('mermaid-block');pre.mermaidSourceLength=source.length;
    const host=document.createElement('div'),tools=document.createElement('div');host.className='mermaid-inline';tools.className='mermaid-tools';tools.hidden=true;
    const stage=document.createElement('div'),status=document.createElement('div');stage.className='mermaid-stage';status.className='mermaid-status';status.textContent='正在渲染流程图…';stage.append(status);
    const details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('code');
    details.className='mermaid-source';summary.textContent='查看流程图源码';raw.textContent=source;details.append(summary,raw);
    host.append(stage,tools,details);pre.replaceChildren(host);
    // 在异步渲染结束前进入源码编辑，会暂时移走 host；恢复时重新排队，避免永远停在加载中。
    host.resumeMermaid=()=>{
      if(!root.contains(pre)||!pre.contains(host))return;
      const pendingCode=document.createElement('code');pendingCode.className='language-mermaid';pendingCode.textContent=source;
      pre.classList.remove('mermaid-block');pre.replaceChildren(pendingCode);renderMermaidBlocks(root,true);
    };
    const current=()=>!viewerDisposed&&epoch===mermaidRenderEpoch&&root.contains(pre)&&pre.contains(host);
    const failed=message=>{host.resumeMermaid=null;status.textContent=message;status.classList.add('error');details.hidden=false;details.open=true;tools.hidden=true;stage.style.height='';};
    if(problem){failed(problem);continue;}
    if(typeof mermaid==='undefined'){failed('流程图组件未加载，请重新打开预览。');continue;}
    mermaidQueue=mermaidQueue.catch(()=>{}).then(async()=>{
      if(!current())return;
      const scratch=document.createElement('div');scratch.style.cssText='position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden';document.body.append(scratch);
      try{
        const result=await mermaid.render('fw-mermaid-'+(++mermaidDiagramId),source,scratch);
        if(!current())return;
        const cleaned=cleanMermaidSvg(result.svg),image=document.createElement('img');
        image.className='mermaid-image';image.alt='Mermaid 流程图 '+number;image.draggable=false;
        image.addEventListener('error',()=>{if(current()){stage.replaceChildren(status);failed('流程图图像无法显示，请查看源码。');}});
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(cleaned.svg);
        stage.replaceChildren(image);details.hidden=true;tools.hidden=false;host.resumeMermaid=null;
        setupInlineMermaid(host,stage,image,tools,cleaned.width,cleaned.height);
      }catch(error){if(current())failed('流程图未能渲染：'+String(error.message||error).slice(0,350));}
      finally{scratch.remove();}
    });
  }
}
