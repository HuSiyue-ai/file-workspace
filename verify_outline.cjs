// 验证实际大纲和文件目录模块的组合，不操作宿主窗口或真实对话。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.hidden=false;this.children=[];this.events={};this.attributes={};this.value='';this.textContent='';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  focus(options){this.focused=options??true;}
  hasPointerCapture(){return false;}
  cloneNode(){const copy=new Element(this.tagName);copy.textContent=this.textContent;return copy;}
  querySelectorAll(){return[];}
  getBoundingClientRect(){return{top:this.top??100};}
  scrollIntoView(options){this.scrolled=options;}
  async emit(name,event={preventDefault(){}}){for(const fn of this.events[name]||[])await fn(event);}
}
async function main(){
  const ids=['directory-panel','directory-toggle','directory-list','directory-message','directory-path','directory-root-name','directory-up-quick','directory-collapse','document-area','directory-up','directory-close','directory-home','directory-refresh','directory-filter','title','directory-resize','outline-toggle','directory-view','outline-view','navigation-heading','outline-list','outline-message','outline-expand','outline-collapse','source','toggle','directory-more','directory-menu','directory-tools'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['directory-panel'].hidden=true;
  const document=new Element();document.getElementById=id=>elements[id];document.createElement=tag=>new Element(tag);document.createTextNode=text=>({textContent:text});document.body=new Element();document.documentElement={style:{setProperty(){}}};
  let headings=[];const preview=new Element();preview.querySelectorAll=()=>headings;
  const heading=(level,text,top)=>{const h=new Element('h'+level);h.textContent=text;h.top=top;return h;};
  let frames=new Map(),frameId=0;const window=new Element();window.innerWidth=1000;window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);
  const calls=[];let resetCount=0;
  const context={window,document,preview,activeFile:{name:'test.md',resourceUri:'resource:test'},hostFileOpenAvailable:true,resetSelectedExcerpt:()=>++resetCount,request:async(method,params)=>{calls.push({method,params});return{structuredContent:{directory:'C:\\notes',parent:'C:\\',entries:[]}};}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(__dirname+'/navigation.js','utf8')+'\n'+fs.readFileSync(__dirname+'/outline.js','utf8'),context);
  await elements['outline-toggle'].emit('click');assert.equal(calls.length,0,'opening the article outline must not read the filesystem');
  assert.equal(elements['outline-view'].hidden,false);assert.equal(elements['directory-view'].hidden,true);assert.equal(elements['outline-toggle'].attributes['aria-expanded'],'true');
  assert.equal(elements['directory-path'].hidden,true);assert.equal(elements['directory-tools'].hidden,true);assert.equal(elements['navigation-heading'].hidden,false);assert.equal(elements['directory-menu'].hidden,true);
  context.rebuildOutline();assert.match(elements['outline-message'].textContent,/没有标题/);
  headings=[heading(1,'报告',-200),heading(2,'步骤',-40),heading(4,'跳级标题',140),heading(2,'步骤',350),heading(1,'结论',500)];
  context.rebuildOutline();const entries=vm.runInContext('outlineEntries',context);
  assert.equal(elements['outline-list'].children.length,2);assert.equal(entries[0].children.length,2);assert.equal(entries[1].children[0],entries[2],'skipped levels attach to nearest shallower heading');
  assert.notEqual(entries[1].button,entries[3].button,'duplicate labels keep separate targets');
  assert.equal(entries[1].button.attributes['aria-current'],'location');
  await elements['outline-collapse'].emit('click');assert.equal(entries[0].details.open,false);assert.equal(entries[1].details.open,false);
  await elements['outline-expand'].emit('click');assert.equal(entries[0].details.open,true);
  preview.hidden=true;elements.source.hidden=false;
  await entries[3].button.emit('click');assert.equal(headings[3].scrolled.block,'start');assert.equal(headings[1].scrolled,undefined);assert.equal(preview.hidden,false);assert.equal(elements.source.hidden,true);assert.equal(resetCount,1);
  assert.equal(entries[3].button.attributes['aria-current'],'location');assert.equal(elements['directory-panel'].hidden,false);
  window.innerWidth=500;await entries[2].button.emit('click');assert.equal(elements['directory-panel'].hidden,false,'narrow-window outline stays beside the document');assert.equal(headings[2].attributes.tabindex,'-1');
  assert.equal(calls.length,0);
  context.syncDocumentNavigation({resourceUri:'resource:second'});assert.equal(calls.length,0,'changing documents while outlining must not list folders');
  await elements['directory-toggle'].emit('click');assert.equal(calls.length,1);assert.equal(elements['directory-view'].hidden,false);assert.equal(elements['outline-view'].hidden,true);
  await elements['outline-toggle'].emit('click');assert.equal(calls.length,1);assert.equal(elements['directory-toggle'].attributes['aria-expanded'],'false');
  headings[2].top=-20;await elements['document-area'].emit('scroll');await elements['document-area'].emit('scroll');assert.equal(frames.size,1,'coalesce document-container scroll updates');
  for(const fn of frames.values())fn();frames.clear();assert.equal(entries[2].button.attributes['aria-current'],'location');
  context.clearOutline();assert.equal(elements['outline-list'].children.length,0);
  headings=[heading(2,'<img onerror=bad> & 重复',50)];context.rebuildOutline();const replacement=vm.runInContext('outlineEntries[0]',context);assert.equal(replacement.button.textContent,'<img onerror=bad> & 重复');assert.equal(replacement.button.children.length,0,'heading labels are text, never injected HTML');
  const mathHeading={cloneNode:()=>({textContent:'placeholder',querySelectorAll:()=>[{querySelector:()=>({textContent:'E=mc^2'}),replaceWith(node){this.result=node.textContent;}}]})};
  // Ensure equation labels use the single TeX annotation rather than duplicate KaTeX representations.
  let replaced='';mathHeading.cloneNode=()=>({get textContent(){return'能量 '+replaced;},querySelectorAll:()=>[{querySelector:()=>({textContent:'E=mc^2'}),replaceWith(node){replaced=node.textContent;}}]});
  assert.equal(context.outlineLabel(mathHeading),'能量 E=mc^2');
  const html=fs.readFileSync(__dirname+'/plugins/markdown-math-preview/viewer.html','utf8');new vm.Script(html.split('<script>')[1].split('</script>')[0]);assert.match(html,/scroll-margin-top:64px/);assert.match(html,/#directory-view\[hidden\],#outline-view\[hidden\]\{display:none\}/);
  console.log('PASS: heading hierarchy and skipped levels, duplicate-title targets, expand/collapse, source-to-preview jump, header offset, document scroll tracking, narrow-window split, mode switching without directory reads, rebuild cleanup, safe labels, formula labels, bundled syntax');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
