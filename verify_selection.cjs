// 隔离验证实际选区模块，绝不向用户的真实对话发送测试内容。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
  constructor(){this.hidden=false;this.disabled=false;this.style={};this.events={};this.children=[];this.offsetWidth=130;this.offsetHeight=38;this.classList={toggle(){}};}
  contains(node){return node===this||this.children.includes(node);}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  async emit(name,event={}){if(name==='click'&&this.disabled)return;for(const fn of this.events[name]||[])await fn(event);}
}
async function main(){
  const elements=Object.fromEntries(['selection-toolbar','selection-add','selection-status','preview','source'].map(id=>[id,new Element()]));
  elements['source'].hidden=true;elements['selection-toolbar'].hidden=true;
  const document=new Element();document.getElementById=id=>elements[id];
  const node={},other={};elements.preview.children.push(node);
  const sourceNode={};elements.source.children.push(sourceNode);
  let selection=null;
  const window=new Element();window.innerWidth=800;window.innerHeight=600;window.getSelection=()=>selection;
  const calls=[],timers=new Map();let timerId=0;
  const context={window,document,preview:elements.preview,activeFile:{name:'中文报告.md',resourceUri:'resource:one'},request:async(method,params)=>{calls.push({method,params});return{};},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/selection.js','utf8'),context);
  const select=(text='要讨论的文段',start=node,end=start)=>{selection={isCollapsed:false,rangeCount:1,toString:()=>text,getRangeAt:()=>({startContainer:start,endContainer:end,getBoundingClientRect:()=>({left:10,right:300,top:150,bottom:220})})};};
  const capabilities={experimental:{'openai/message':{}},message:{text:{}}};
  context.setSelectionHostCapabilities(capabilities);
  assert.equal(calls.length,0);assert.equal(elements['selection-toolbar'].hidden,true);
  select();await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,false);assert.equal(calls.length,0,'selection must never send or attach content automatically');
  let prevented=false;await elements['selection-add'].emit('pointerdown',{preventDefault(){prevented=true;}});assert.equal(prevented,true,'button preserves the selected range');
  await elements['selection-add'].emit('click');assert.equal(calls.length,1);assert.equal(calls[0].method,'ui/message');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params._meta)),{'openai/message':{target:'active',send:false}});
  assert.equal(calls[0].params.role,'user');assert.match(calls[0].params.content[0].text,/中文报告.md\n所选文段：\n要讨论的文段/);
  assert.equal(calls[0].params.content[0]._meta['openai/title'],'中文报告.md · 选中文段');assert.equal(elements['selection-toolbar'].hidden,true);
  assert.match(elements['selection-status'].textContent,/输入框/);
  select();await document.emit('selectionchange');await document.emit('contextmenu',{target:node,clientX:799,clientY:599,preventDefault(){}});
  assert.ok(parseFloat(elements['selection-toolbar'].style.left)<=662);assert.ok(parseFloat(elements['selection-toolbar'].style.top)<=554);
  prevented=false;await document.emit('contextmenu',{target:other,preventDefault(){prevented=true;}});assert.equal(prevented,false,'keep unrelated context menus');
  selection=null;await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,true);
  select('',node);await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,true);
  select('外部',other);await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,true);
  select('跨正文和目录',node,other);await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,true);
  elements.preview.hidden=true;select();await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,true);
  elements.source.hidden=false;select('源码片段',sourceNode);await document.emit('selectionchange');assert.equal(elements['selection-toolbar'].hidden,false);
  await document.emit('keydown',{key:'Escape'});assert.equal(elements['selection-toolbar'].hidden,true);
  elements.preview.hidden=false;elements.source.hidden=true;
  select();await document.emit('selectionchange');context.activeFile={name:'另一个.md',resourceUri:'resource:two'};await elements['selection-add'].emit('click');assert.equal(calls.length,1,'do not attach a stale selection from another file');
  context.resetSelectedExcerpt();await document.emit('selectionchange');context.setSelectionHostCapabilities({message:{text:{}}});assert.equal(elements['selection-add'].disabled,true);
  await elements['selection-add'].emit('click');assert.equal(calls.length,1,'no fallback to sending a message without draft capability');
  context.setSelectionHostCapabilities(capabilities);
  let finish;context.request=(method,params)=>{calls.push({method,params});return new Promise(resolve=>finish=resolve);};
  select();await document.emit('selectionchange');const pending=elements['selection-add'].emit('click');await elements['selection-add'].emit('click');assert.equal(calls.length,2,'ignore duplicate clicks while waiting');finish({});await pending;
  context.request=async()=>{throw new Error('composer unavailable');};select();await document.emit('selectionchange');await elements['selection-add'].emit('click');assert.match(elements['selection-status'].textContent,/添加失败/);assert.equal(elements['selection-add'].disabled,false);
  const before=calls.length;select('a'.repeat(100001));await document.emit('selectionchange');await elements['selection-add'].emit('click');assert.equal(calls.length,before);assert.match(elements['selection-status'].textContent,/太长/);
  select();await document.emit('selectionchange');await window.emit('blur');assert.equal(elements['selection-toolbar'].hidden,true);
  const html=fs.readFileSync(__dirname+'/plugins/markdown-math-preview/viewer.html','utf8');new vm.Script(html.split('<script>')[1].split('</script>')[0]);
  assert.match(html,/#selection-toolbar\[hidden\],#selection-status\[hidden\]\{display:none\}/);
  console.log('PASS: selection-only activation, scoped selection, source mode, preserved range, current-file guard, context-menu scope, viewport bounds, draft-only attachment with filename, unsupported-host guard, duplicate-click guard, failure recovery, size limit, Escape/blur, bundled syntax');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
