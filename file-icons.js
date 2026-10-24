// Offline, original SVG file icons. Classification never opens a file or uses authored HTML.
const fileIconGroups=[
  ['markdown','M↓','md markdown'],['image','','png jpg jpeg gif webp svg bmp ico avif heic heif tif tiff'],
  ['pdf','PDF','pdf'],['word','W','doc docx docm odt rtf'],['sheet','X','xls xlsx xlsm xlsb ods csv tsv'],
  ['slides','P','ppt pptx pptm odp'],['archive','ZIP','zip rar 7z tar gz bz2 xz tgz'],
  ['javascript','JS','js jsx mjs cjs'],['typescript','TS','ts tsx'],['python','Py','py pyw pyi'],
  ['notebook','IPY','ipynb'],['json','{}','json jsonc jsonl'],['html','<>','html htm vue svelte'],
  ['css','#','css scss sass less'],['config','⚙','toml ini yaml yml env conf config'],
  ['terminal','>_','sh bash zsh ps1 bat cmd'],['code','C','c cpp cxx cc h hpp cs'],
  ['code','J','java kt kts'],['code','RS','rs'],['code','GO','go'],['database','SQL','sql sqlite sqlite3 db'],
  ['document','TeX','tex bib'],['video','','mp4 webm mov mkv avi'],['audio','','mp3 wav flac aac m4a ogg'],
  ['shortcut','↗','lnk url'],['text','','txt log rst'],
];
function describeFileIcon(name,kind='file'){
  if(kind==='directory')return {kind:'folder',label:''};
  const value=String(name||'').toLowerCase(),extension=value.includes('.')?value.split('.').pop():'';
  if(value==='dockerfile')return {kind:'code',label:'D'};
  if(value==='makefile')return {kind:'config',label:'⚙'};
  for(const [kind,label,extensions] of fileIconGroups)if(extensions.split(' ').includes(extension))return {kind,label};
  return {kind:'text',label:''};
}
function decorateDirectoryFileIcon(element,node){
  const spec=describeFileIcon(node.name,node.kind);
  if(spec.kind==='folder')return;
  element.textContent='';element.classList.add('typed-file-icon','file-icon--'+spec.kind);element.setAttribute('data-file-icon',spec.kind);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const add=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));svg.append(el);return el;};
  if(spec.kind==='image'){
    add('rect',{x:2,y:3,width:16,height:14,rx:2,fill:'currentColor',opacity:.16});add('rect',{x:2,y:3,width:16,height:14,rx:2,fill:'none',stroke:'currentColor','stroke-width':1.3});
    add('circle',{cx:6,cy:7,r:1.5,fill:'currentColor'});add('path',{d:'M3 15l5-5 3 3 3-4 3 6z',fill:'currentColor'});
  }else if(spec.kind==='video'||spec.kind==='audio'){
    add('rect',{x:2,y:2,width:16,height:16,rx:3,fill:'currentColor',opacity:.14});
    add('path',{d:spec.kind==='video'?'M8 5l7 5-7 5z':'M9 14V5l7-2v9M9 6l7-2',fill:spec.kind==='video'?'currentColor':'none',stroke:'currentColor','stroke-width':1.5});
    if(spec.kind==='audio'){add('ellipse',{cx:7,cy:14,rx:2,ry:1.7,fill:'currentColor'});add('ellipse',{cx:14,cy:12,rx:2,ry:1.7,fill:'currentColor'});}
  }else{
    add('path',{d:'M4 1.8h8l4 4v12.4H4z',fill:'currentColor',opacity:.12});add('path',{d:'M4 1.8h8l4 4v12.4H4zM12 2v4h4',fill:'none',stroke:'currentColor','stroke-width':1.25,'stroke-linejoin':'round'});
    if(spec.label){const label=add('text',{x:10,y:13.2,'text-anchor':'middle','font-family':'system-ui,sans-serif','font-size':spec.label.length>2?5.5:7.2,'font-weight':750,fill:'currentColor'});label.textContent=spec.label;}
    else add('path',{d:'M6 8h7M6 11h7M6 14h5',fill:'none',stroke:'currentColor','stroke-width':1.1});
  }
  element.append(svg);
}
