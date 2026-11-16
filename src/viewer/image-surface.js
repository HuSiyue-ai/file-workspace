// 统一预览中的图片区域，无宿主导航副作用；只使用 CSP 允许的 data: 地址。
const pictureSurface=(()=>{
  const get=id=>document.getElementById('picture-'+id),stage=get('stage'),image=get('image'),message=get('message');
  let width=0,height=0,scale=1,x=0,y=0,mode='fit',drag=null,serial=0,lastW=0,lastH=0;
  const buttons=['in','out','fit','actual'].map(get);
  function stop(){const old=drag;drag=null;stage.classList.remove('dragging');if(old&&stage.hasPointerCapture(old.id))stage.releasePointerCapture(old.id);}
  function clear(){++serial;stop();width=height=0;image.onload=image.onerror=null;image.removeAttribute('src');image.hidden=true;
    buttons.forEach(button=>button.disabled=true);get('zoom').textContent='—';get('dimensions').textContent='—';}
  function fitting(){return Math.min(1,Math.max(1,stage.clientWidth-24)/width,Math.max(1,stage.clientHeight-24)/height);}
  function paint(){if(!width)return;const w=width*scale,h=height*scale;
    x=w<=stage.clientWidth?(stage.clientWidth-w)/2:Math.max(stage.clientWidth-w,Math.min(0,x));
    y=h<=stage.clientHeight?(stage.clientHeight-h)/2:Math.max(stage.clientHeight-h,Math.min(0,y));
    image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
    get('zoom').textContent=Number((scale*100).toFixed(scale<.1?2:0))+'%';get('in').disabled=scale>=32;get('out').disabled=scale<=Math.min(.01,fitting())+1e-9;
  }
  function fit(){if(!width)return;stop();mode='fit';scale=fitting();x=(stage.clientWidth-width*scale)/2;y=(stage.clientHeight-height*scale)/2;paint();}
  function zoom(value,ax=stage.clientWidth/2,ay=stage.clientHeight/2){if(!width)return;
    const next=Math.max(Math.min(.01,fitting()),Math.min(32,value));x=ax-(ax-x)*next/scale;y=ay-(ay-y)*next/scale;scale=next;mode='manual';paint();}
  function show(data,name){
    clear();const current=serial;message.hidden=false;message.textContent='正在显示图片…';
    if(typeof data.blob!=='string'||data.blob.length>Math.ceil(40*1024*1024/3)*4||!/^image\/(png|jpeg|gif|webp|svg\+xml|bmp|x-icon|avif)$/.test(data.mimeType)){
      message.textContent='图片数据不完整或超过大小限制。';return;
    }
    image.onload=()=>{if(current!==serial)return;width=image.naturalWidth;height=image.naturalHeight;
      if(!width||!height||width*height>100000000){clear();message.textContent='图片尺寸无效或超过 1 亿像素。';return;}
      image.style.width=width+'px';image.style.height=height+'px';image.alt=name;image.hidden=false;message.hidden=true;
      buttons.forEach(button=>button.disabled=false);get('dimensions').textContent=`${width} × ${height} · ${data.mimeType.slice(6).toUpperCase()}`;
      lastW=stage.clientWidth;lastH=stage.clientHeight;fit();};
    image.onerror=()=>{if(current!==serial)return;clear();message.hidden=false;message.textContent='图片无法显示，请检查编码和文件内容。';};
    image.src='data:'+data.mimeType+';base64,'+data.blob;
  }
  get('in').addEventListener('click',()=>{stop();zoom(scale*1.25);});get('out').addEventListener('click',()=>{stop();zoom(scale/1.25);});
  get('fit').addEventListener('click',fit);get('actual').addEventListener('click',()=>{stop();zoom(1);});
  stage.addEventListener('wheel',event=>{if(!width)return;event.preventDefault();stop();const rect=stage.getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1);zoom(scale*Math.exp(-Math.max(-300,Math.min(300,delta))*.002),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
  stage.addEventListener('dblclick',event=>{if(!width)return;event.preventDefault();stop();if(mode==='manual'&&Math.abs(scale-1)<.001)fit();
    else{const rect=stage.getBoundingClientRect();zoom(1,event.clientX-rect.left,event.clientY-rect.top);}});
  stage.addEventListener('pointerdown',event=>{if(!width||event.button!==0||drag)return;event.preventDefault();stage.focus({preventScroll:true});
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x,y};stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');});
  stage.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;x=drag.x+event.clientX-drag.startX;y=drag.y+event.clientY-drag.startY;paint();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,event=>{if(drag?.id===event.pointerId)stop();});
  stage.addEventListener('keydown',event=>{if(!width||event.ctrlKey||event.metaKey||event.altKey)return;
    if(['+','=','-','0','1','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(event.key)){event.preventDefault();stop();
      if(event.key==='0'||event.key==='Escape')fit();else if(event.key==='1')zoom(1);else if(event.key==='+'||event.key==='=')zoom(scale*1.25);else if(event.key==='-')zoom(scale/1.25);
      else{if(event.key==='ArrowLeft')x+=60;if(event.key==='ArrowRight')x-=60;if(event.key==='ArrowUp')y+=60;if(event.key==='ArrowDown')y-=60;paint();}}});
  const observer=new ResizeObserver(()=>{if(!width)return;stop();if(mode==='fit')fit();else{x+=(stage.clientWidth-lastW)/2;y+=(stage.clientHeight-lastH)/2;paint();}lastW=stage.clientWidth;lastH=stage.clientHeight;});observer.observe(stage);
  window.addEventListener('blur',stop);window.addEventListener('pagehide',()=>{clear();observer.disconnect();});
  return{clear,show};
})();
