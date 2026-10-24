// Safe read-only text and CSV views. Source strings are never evaluated.
const codeLanguageByExtension={py:'python',pyw:'python',pyi:'python',js:'javascript',jsx:'javascript',mjs:'javascript',cjs:'javascript',ts:'typescript',tsx:'typescript',json:'json',ipynb:'json',yaml:'yaml',yml:'yaml',toml:'ini',ini:'ini',xml:'xml',html:'xml',htm:'xml',vue:'xml',css:'css',scss:'scss',sh:'bash',bash:'bash',ps1:'powershell',bat:'dos',cmd:'dos',c:'c',cpp:'cpp',h:'c',hpp:'cpp',java:'java',go:'go',rs:'rust',sql:'sql',tex:'latex',bib:'latex'};
let csvState=null,csvFilterTimer=null;
function highlightedCode(text,language){
  if(typeof hljs==='undefined'||!language||!hljs.getLanguage(language)||text.length>200000)return null;
  try{return DOMPurify.sanitize(hljs.highlight(text,{language,ignoreIllegals:true}).value,{ALLOWED_TAGS:['span'],ALLOWED_ATTR:['class']});}catch{return null;}
}
function highlightMarkdownCode(root){
  let remaining=100000;
  for(const code of root.querySelectorAll('pre>code')){
    const language=[...code.classList].find(name=>name.startsWith('language-'))?.slice(9),text=code.textContent;
    if(text.length>25000||text.length>remaining)continue;remaining-=text.length;
    const html=highlightedCode(text,language);if(html!==null){code.innerHTML=html;code.classList.add('code-highlight');}
  }
}
function showTextFile(data){
  const source=document.getElementById('source'),note=document.getElementById('format-note');
  if(data.table){
    csvState={table:data.table,text:data.text,page:0};document.getElementById('csv-view').hidden=false;
    document.getElementById('csv-mode').value='table';document.getElementById('csv-filter').value='';document.getElementById('csv-header').checked=true;
    source.textContent=data.text;setCsvMode('table');return;
  }
  const extension=data.name.toLowerCase().split('.').pop(),language=codeLanguageByExtension[extension],html=highlightedCode(data.text,language);
  if(html!==null){source.innerHTML=html;source.className='code-highlight';}else source.textContent=data.text;
  source.hidden=false;note.hidden=!language;note.textContent=language?language+' · 只读'+(data.text.length>200000?' · 文件较大，显示原文以保持流畅':''):'';
}
function clearFormatSurfaces(){
  if(typeof pdfSurface!=='undefined')pdfSurface.clear();
  clearTimeout(csvFilterTimer);csvFilterTimer=null;csvState=null;
  document.getElementById('csv-view').hidden=true;document.getElementById('csv-table').replaceChildren();
  document.getElementById('format-note').hidden=true;document.getElementById('source').className='';
}
function setCsvMode(mode){
  const raw=mode==='source';document.getElementById('source').hidden=!raw;document.getElementById('csv-data').hidden=raw;
  if(!raw)renderCsvTable();
}
function renderCsvTable(){
  if(!csvState)return;const data=csvState.table,table=document.getElementById('csv-table'),message=document.getElementById('csv-message');table.replaceChildren();
  if(data.error){message.textContent=data.error;document.getElementById('csv-page').textContent='—';return;}
  const rows=data.rows||[],header=document.getElementById('csv-header').checked,query=document.getElementById('csv-filter').value.toLocaleLowerCase(),body=rows.slice(header?1:0);
  const selected=[];for(let index=0;index<body.length;index++)if(!query||body[index].some(cell=>String(cell).toLocaleLowerCase().includes(query)))selected.push(index);
  const pages=Math.max(1,Math.ceil(selected.length/50));csvState.page=Math.max(0,Math.min(pages-1,csvState.page));
  const columns=Math.min(100,data.columns||0),head=document.createElement('thead'),headRow=document.createElement('tr'),corner=document.createElement('th');corner.textContent='#';headRow.append(corner);
  let clipped=false;
  const fill=(el,value)=>{const text=String(value??'');el.textContent=text.length>2000?text.slice(0,2000)+'…':text;if(text.length>2000)clipped=true;else if(text.length<=1000)el.title=text;};
  for(let column=0;column<columns;column++){const th=document.createElement('th');fill(th,header?rows[0]?.[column]??'列 '+(column+1):'列 '+(column+1));headRow.append(th);}head.append(headRow);table.append(head);
  const tbody=document.createElement('tbody');
  for(const index of selected.slice(csvState.page*50,csvState.page*50+50)){
    const tr=document.createElement('tr'),label=document.createElement('th');label.scope='row';label.textContent=String(index+(header?2:1));tr.append(label);
    for(let column=0;column<columns;column++){const td=document.createElement('td');fill(td,body[index][column]);tr.append(td);}tbody.append(tr);
  }table.append(tbody);
  document.getElementById('csv-page').textContent=(csvState.page+1)+' / '+pages+' 页';
  document.getElementById('csv-prev').disabled=csvState.page===0;document.getElementById('csv-next').disabled=csvState.page>=pages-1;
  const notes=[selected.length+' 行 · '+columns+' 列'];if(data.truncated)notes.push('数据较大，表格仅展示有限行；完整内容可切换原文');if(data.columnTruncated)notes.push('仅显示前 100 列');if(clipped)notes.push('长单元格仅显示前 2000 字符');
  message.textContent=notes.join(' · ');
}
document.getElementById('csv-mode').addEventListener('change',event=>setCsvMode(event.target.value));
document.getElementById('csv-filter').addEventListener('input',()=>{clearTimeout(csvFilterTimer);csvFilterTimer=setTimeout(()=>{if(csvState){csvState.page=0;renderCsvTable();}},160);});
document.getElementById('csv-header').addEventListener('change',()=>{if(csvState){csvState.page=0;renderCsvTable();}});
document.getElementById('csv-prev').addEventListener('click',()=>{if(csvState){csvState.page--;renderCsvTable();}});
document.getElementById('csv-next').addEventListener('click',()=>{if(csvState){csvState.page++;renderCsvTable();}});
