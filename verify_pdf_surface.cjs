const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.hidden=false;this.style={};this.children=[];this.events={};this.value='';this.textContent='';this.clientWidth=600;this.attrs={};this.classList={add(){},remove(){}};}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}removeAttribute(n){delete this[n];}setAttribute(n,v){this.attrs[n]=v;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
 async emit(n,event={}){for(const fn of this.events[n]||[])await fn({preventDefault(){},...event});}
}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},calls=[];
const ctx={document:{getElementById:el,createElement:()=>new Element()},window:{devicePixelRatio:1},outlineEntries:[],outlineList:new Element(),outlineMessage:new Element(),setTimeout,clearTimeout,
 clearOutline(){ctx.outlineEntries=[];ctx.outlineList.replaceChildren();},markOutlineCurrent(){},request:(method,params)=>new Promise(resolve=>calls.push({method,params,resolve}))};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/pdf-surface.js','utf8'),ctx);const run=s=>vm.runInContext(s,ctx),tick=()=>new Promise(resolve=>setImmediate(resolve));
const info=name=>({path:'C:/'+name+'.pdf',revision:'r',pageCount:2,pageWidth:600,pageHeight:800,outline:[]});
const page=blob=>({structuredContent:{page:1,pageCount:2,pageWidth:600,pageHeight:800,mimeType:'image/png',blob,boxes:[]}});
async function main(){
 ctx.first=info('first');ctx.second=info('second');
 const first=run('pdfSurface.show(first)'),old=calls.at(-1),second=run('pdfSurface.show(second)'),latest=calls.at(-1);
 old.resolve(page('OLD'));await first;assert.notEqual(el('pdf-image').src,'data:image/png;base64,OLD');
 latest.resolve(page('NEW'));await second;assert.equal(el('pdf-image').src,'data:image/png;base64,NEW');assert.equal(el('pdf-image').hidden,false);assert.equal(el('pdf-page').value,'1');
 const next=el('pdf-next').emit('click');assert.equal(el('pdf-image').hidden,true,'hide stale page while rendering');calls.at(-1).resolve({isError:true,content:[{type:'text',text:'页面错误'}]});await next;assert.equal(el('pdf-image').hidden,true);assert.match(el('pdf-message').textContent,/页面错误/);
 el('pdf-search').value='needle';await el('pdf-search-form').emit('submit');const search=calls.at(-1);run('pdfSurface.clear()');search.resolve({structuredContent:{matches:[{page:2,count:1}],scanned:2,nextPage:null}});await tick();
 assert.equal(el('pdf-view').hidden,true);assert.equal(el('pdf-results').children.length,0,'closed file never receives old search results');
 assert.equal(el('pdf-image').src,undefined);console.log('PASS: PDF stale render suppression, page error hides old image, teardown releases image and ignores pending search results');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
