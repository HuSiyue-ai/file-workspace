// 回归：鼠标命中在重排前固定；源码偏移不受高亮 span、UTF-16 或后续 click 影响。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.nodeType=1;this.children=[];this.childNodes=[];this.events={};this.style={};this.dataset={};this.options=[];this.classList={contains:()=>true,toggle(){},add(){},remove(){}};}
 addEventListener(n,f){(this.events[n]??=[]).push(f);}removeEventListener(){}setAttribute(){}removeAttribute(){}querySelectorAll(){return[];}getBoundingClientRect(){return{top:100,bottom:200,height:100,width:600};}replaceChildren(...nodes){this.childNodes=nodes;}contains(n){return n===this||n?.block===this;}closest(){return null;}
}
const ids=new Map(),document=new Element(),window=new Element();document.getElementById=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const preview=new Element(),ctx={document,window,preview,activeFile:{kind:'markdown',revision:'x'},localStorage:{getItem(){return null;}},setTimeout,clearTimeout,resetSelectedExcerpt(){},readGeneration:1};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/block-editor.js','utf8'),ctx);const run=s=>vm.runInContext(s,ctx);
const codeText='first 😀\nsecond line\n',source='```js\n'+codeText+'```\n';
const block=new Element(),code=new Element(),textNode={nodeType:3,textContent:'second line',block,parentElement:{closest:()=>code}};block.dataset={sourceFrom:'0',sourceTo:String(source.length)};block.textContent=codeText;code.textContent=codeText;code.block=block;block.parentElement=preview;
document.caretPositionFromPoint=()=>({offsetNode:textNode,offset:4});
document.createRange=()=>({base:block,selectNodeContents(n){this.base=n;},setEnd(){},toString(){return codeText.slice(0,codeText.indexOf('second')+4);}});
run("displayMode='edit';editorSession={text:'',saving:false}");ctx.testSource=source;run('editorSession.text=testSource');
assert.equal(ctx.sourceCaretAtPoint(block,{clientX:250,clientY:150}),source.indexOf('second')+4,'highlighted code cursor follows the clicked line, including UTF-16 emoji before it');
const prose='前文 **目标** 后文\n',proseNode={nodeType:3,textContent:'目标',block,parentElement:{closest:()=>null}};block.dataset.sourceTo=String(prose.length);block.textContent='前文 目标 后文';document.caretPositionFromPoint=()=>({offsetNode:proseNode,offset:1});ctx.testSource=prose;run('editorSession.text=testSource');
assert.equal(ctx.sourceCaretAtPoint(block,{clientX:250,clientY:150}),prose.indexOf('目标')+1,'inline Markdown syntax is excluded from the visible text offset');
document.caretPositionFromPoint=()=>({offsetNode:{nodeType:1},offset:0});assert.equal(ctx.sourceCaretAtPoint(block,{}),null,'image/blank clicks anchor the block instead of inventing a text position');
const target=new Element();target.parentElement=preview;target.dataset={sourceFrom:'100',sourceTo:'150'};const wrong=new Element();wrong.parentElement=preview;wrong.dataset={sourceFrom:'200',sourceTo:'250'};
let opened=[],closed=[];ctx.sourceCaretAtPoint=()=>9;ctx.closeActiveBlock=from=>closed.push(from);ctx.openBlockAt=(...args)=>opened.push(args);
let prevented=false;document.events.pointerdown[0]({button:0,target,clientY:333,preventDefault(){prevented=true;}});
ctx.handleBlockClick({target:wrong,clientY:333});assert.equal(prevented,true);assert.deepEqual(closed,[100]);assert.equal(opened.length,1,'follow-up click cannot activate the block which moved underneath the pointer');assert.equal(opened[0][0],100);assert.equal(opened[0][1],9);assert.equal(opened[0][2].y,333);
const area=document.getElementById('document-area');area.scrollTop=300;area.scrollLeft=0;area.clientHeight=600;preview.children=[target];target.getBoundingClientRect=()=>({top:140,bottom:200,height:60});preview.getBoundingClientRect=()=>({height:900});
ctx.restoreEditorView({from:100,y:100,top:300,left:0});assert.equal(area.scrollTop,340,'layout replacement restores the same viewport anchor');
console.log('PASS: click source mapping for highlighted code, emoji and bold text; blank fallback; fixed pointer target; no second-click retarget; viewport anchor compensation');
