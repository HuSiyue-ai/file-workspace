const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.hidden=false;this.children=[];this.events={};this.style={};this.value='';this.textContent='';this.offsetWidth=360;this.offsetHeight=44;this.scrollHeight=30;}
 contains(node){return node===this||this.children.includes(node);}append(node){this.children.push(node);}replaceChildren(...nodes){this.children=nodes;}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}setAttribute(name,value){this[name]=value;}
 getBoundingClientRect(){return {left:12,right:470,top:48,bottom:600,width:458,height:552};}focus(){document.activeElement=this;}
 emit(name,event={}){for(const fn of this.events[name]||[])fn({preventDefault(){},stopPropagation(){},...event});}
}
const ids=['excerpt-quick-editor','excerpt-quick-input','excerpt-quick-error','excerpt-markers','excerpt-comments-open','excerpt-quick-confirm','excerpt-quick-cancel','document-area','source'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['source'].hidden=true;elements['excerpt-quick-editor'].hidden=true;
const preview=new Element(),node={};preview.children.push(node);
const document=new Element();document.getElementById=id=>elements[id];document.createElement=()=>new Element();
const window=new Element();window.innerWidth=500;window.innerHeight=720;let cleaned=0;window.getSelection=()=>({removeAllRanges:()=>cleaned++});
const frames=new Map();let frame=0,renders=0,disconnected=0;
class Observer{observe(){}disconnect(){disconnected++;}}
const highlights=new Map();
const context={document,window,preview,viewerDisposed:false,activeFile:{resourceUri:'file:a'},excerptComments:[],excerptCommentsBusy:false,excerptCommentNext:0,
 resetSelectedExcerpt(){},renderExcerptComments(){renders++;context.scheduleExcerptMarkers();},MutationObserver:Observer,ResizeObserver:Observer,CSS:{highlights},Highlight:class{constructor(...ranges){this.ranges=ranges;}},
 requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id)};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/comment-bubbles.js','utf8'),context);
function range(text='选文'){return {startContainer:node,endContainer:node,toString:()=>text,cloneRange(){return range(text);},getClientRects:()=>[{left:40,right:260,top:160,bottom:182,width:220,height:22}]};}
function quote(){return {text:'选文',name:'a.md',path:'C:/test/a.md',uri:'file:a',range:range(),comment:''};}
function flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
context.openQuickExcerptComment(quote());assert.equal(context.excerptComments.length,0,'opening is not confirmation');assert.equal(elements['excerpt-quick-editor'].hidden,false);
elements['excerpt-quick-input'].value='第一条评论';context.confirmQuickExcerptComment();assert.equal(context.excerptComments.length,1);flush();assert.equal(elements['excerpt-markers'].children.length,1);assert.equal(preview.children.length,1,'no wrapper mutations to Markdown');assert.equal(highlights.size,1);
const id=context.excerptComments[0].id;elements['excerpt-markers'].children[0].emit('click');assert.equal(elements['excerpt-quick-input'].value,'第一条评论');
elements['excerpt-quick-input'].value='改后的评论';context.confirmQuickExcerptComment();assert.equal(context.excerptComments.length,1);assert.equal(context.excerptComments[0].id,id);assert.equal(context.excerptComments[0].comment,'改后的评论');
context.openQuickExcerptComment(quote());elements['excerpt-quick-input'].value='取消这段';elements['excerpt-quick-editor'].emit('keydown',{key:'Escape'});assert.equal(context.excerptComments.length,1);
context.openQuickExcerptComment(quote());elements['excerpt-quick-editor'].emit('keydown',{key:'Enter',isComposing:true});assert.equal(context.excerptComments.length,1,'IME confirmation cannot submit');
elements['excerpt-quick-input'].value='点击外部保留';document.emit('pointerdown',{target:new Element()});assert.equal(context.excerptComments.length,2);flush();
const bubbles=elements['excerpt-markers'].children;assert.equal(bubbles.length,2);assert.notEqual(bubbles[0].style.top,bubbles[1].style.top,'overlapping quotes get separate bubbles');
const multi=quote();multi.text='first\n\nsecond';multi.range=range('first\nsecond');context.openQuickExcerptComment(multi);context.confirmQuickExcerptComment();flush();assert.equal(elements['excerpt-markers'].children.length,3,'cross-paragraph selection uses captured range text rather than rendered newlines');
context.activeFile={resourceUri:'file:b'};context.refreshExcerptMarkers();assert.equal(elements['excerpt-markers'].children.length,0);assert.equal(context.excerptComments.length,3,'file switch hides markers without losing comments');assert.equal(highlights.size,0);
context.activeFile={resourceUri:'file:a'};context.openQuickExcerptComment(context.excerptComments[0],true);assert.ok(parseFloat(elements['excerpt-quick-editor'].style.left)>=8);
elements['excerpt-quick-input'].value='x'.repeat(5001);assert.equal(context.confirmQuickExcerptComment(),false);assert.equal(context.excerptComments[0].comment,'改后的评论');
window.emit('pagehide');assert.equal(elements['excerpt-markers'].children.length,0);assert.equal(elements['excerpt-quick-editor'].hidden,true);assert.equal(disconnected,2);
console.log('PASS: quick confirm/edit/cancel, IME guard, outside retention, stable IDs, overlay-only markers, collision spacing, cross-file hiding, narrow bounds, size limits and teardown');
