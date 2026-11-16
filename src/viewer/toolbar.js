const viewerOptions=document.getElementById('viewer-options');
document.addEventListener('pointerdown',event=>{if(viewerOptions.open&&!viewerOptions.contains(event.target))viewerOptions.open=false;},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&viewerOptions.open){event.preventDefault();event.stopPropagation();viewerOptions.open=false;viewerOptions.querySelector('summary').focus();}},true);
document.getElementById('size').addEventListener('change',()=>viewerOptions.open=false);
document.getElementById('refresh').addEventListener('click',()=>viewerOptions.open=false);
window.addEventListener('blur',()=>viewerOptions.open=false);
