const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.events={};this.dataset={};this.classes=new Set();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),toggle:name=>{if(this.classes.has(name)){this.classes.delete(name);return false;}this.classes.add(name);return true;}};}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 contains(node){return this===node||this.children.some(n=>n.contains(node));}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 addEventListener(name,fn){this.events[name]=fn;}setAttribute(name,value){this[name]=value;}getBoundingClientRect(){return{width:this.clientWidth||600,height:100};}querySelectorAll(selector){const all=[];const walk=n=>{for(const c of n.children){all.push(c);walk(c);}};walk(this);return all.filter(n=>selector==='pre.mermaid-block'?n.tag==='pre'&&n.classes.has('mermaid-block'):n.tag==='code'&&n.className==='language-mermaid'&&n.parentElement?.tag==='pre');}
}
const document={body:new Element(),createElement:tag=>new Element(tag)};
let finishA,config,calls=[];
const context={document,window:{innerHeight:800},viewerDisposed:false,mermaid:{initialize:c=>config=c,render:async(id,source)=>{calls.push(source);if(source==='first')return new Promise(resolve=>finishA=resolve);if(source==='bad')throw Error('syntax error');return{svg:'safe SVG'};}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/mermaid-surface.js','utf8'),context);
context.cleanMermaidSvg=svg=>({svg,width:100,height:60});
function root(...sources){const r=new Element();r.codes=sources.map(source=>{const pre=new Element('pre'),code=new Element('code');pre.dataset.sourceFrom='4';pre.dataset.sourceTo='80';code.textContent=source;code.className='language-mermaid';pre.append(code);r.append(pre);return code;});return r;}
function descendants(e,tag){return e.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...descendants(c,tag)]);}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
 assert.equal(config.securityLevel,'strict');assert.equal(config.startOnLoad,false);assert.equal(config.htmlLabels,false);
 assert.ok(context.mermaidSourceProblem('%%{init:{}}%%',1,1000));assert.ok(context.mermaidSourceProblem('---\nconfig: true',1,1000));assert.ok(context.mermaidSourceProblem('x',21,1000));assert.ok(context.mermaidSourceProblem('x'.repeat(20001),1,100000));
 const a=root('first');context.renderMermaidBlocks(a);await turn();assert.ok(finishA);
 const b=root('second');context.renderMermaidBlocks(b);finishA({svg:'old SVG'});await turn();await turn();
 assert.equal(descendants(a,'img').length,0,'late result never renders after a different document');assert.equal(descendants(b,'img').length,1);
 assert.equal(descendants(b,'div').filter(e=>e.className==='mermaid-status'&&String(e.textContent).includes('未能')).length,0,'viewer setup must finish without a hidden runtime error');
 const stage=descendants(b,'div').find(e=>e.className==='mermaid-stage'),tools=descendants(b,'div').find(e=>e.className==='mermaid-tools');
 const initialHeight=stage.style.height;tools.children[2].events.click();assert.equal(tools.children[1].textContent,'125%');assert.equal(stage.style.height,initialHeight,'zoom never changes document height');tools.children[3].events.click();assert.equal(tools.children[1].textContent,'100%');
 assert.equal(descendants(b,'details')[0].hidden,true,'successful diagram has no source panel');
 assert.equal(b.children[0].dataset.sourceFrom,'4');assert.equal(b.children[0].dataset.sourceTo,'80','original editor offsets remain intact');
 const c=root('bad','good');context.renderMermaidBlocks(c);await turn();await turn();
 assert.equal(descendants(c,'img').length,1,'syntax error does not block following diagram');assert.ok(descendants(c,'details')[0].open);
 assert.ok(descendants(c,'div').some(e=>String(e.textContent).includes('syntax error')));assert.ok(descendants(c,'code').some(e=>e.textContent==='bad'),'raw code is retained');
 const d=root('first');context.renderMermaidBlocks(d);await turn();const pre=d.children[0],host=pre.children[0];pre.replaceChildren(new Element('textarea'));finishA({svg:'discarded during edit'});await turn();assert.equal(descendants(d,'img').length,0);pre.replaceChildren(host);host.resumeMermaid();await turn();finishA({svg:'resumed'});await turn();await turn();assert.equal(descendants(d,'img').length,1,'leaving an editor requeues a diagram whose render was interrupted');
 const e=root('first');context.renderMermaidBlocks(e);await turn();context.renderMermaidBlocks(e,true);finishA({svg:'retained pending graph'});await turn();assert.equal(descendants(e,'img').length,1,'preserving other blocks must not invalidate a pending render');
 assert.equal(document.body.children.length,0,'temporary render containers are always released');
 assert.match(descendants(b,'img')[0].src,/^data:image\/svg\+xml/);assert.ok(!fs.readFileSync(__dirname+'/vendor/mermaid/mermaid.min.js','utf8').includes('import('),'single offline build has no runtime chunk imports');
 console.log('PASS: strict offline setup, limits/directive guards, stale render cancellation, source-offset preservation, error/source fallback, queue recovery and render-container cleanup');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
