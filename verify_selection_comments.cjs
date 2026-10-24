const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.readOnly=false;}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn);}setAttribute(name,value){this[name]=value;}
 querySelectorAll(selector){let found=[];for(const child of this.children){if(selector.split(',').includes(child.tagName))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}focus(){document.activeElement=this;}
 async emit(type,event={}){for(const fn of this.events[type]||[])await fn({preventDefault(){},stopPropagation(){},...event});}
}
const ids=['selection-comment','excerpt-comment-dialog','excerpt-comment-list','excerpt-comments-open','excerpt-comments-send','excerpt-comments-continue','excerpt-comments-close','excerpt-comment-status','directory-toggle'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['excerpt-comment-dialog'].hidden=true;
const document={getElementById:id=>elements[id],createElement:tag=>new Element(tag)},window=new Element();
const calls=[],notices=[];
const context={document,window,selectionBusy:false,selectionDraftAvailable:true,viewerDisposed:false,selectedExcerpt:null,activeFile:{path:'C:/test/a.md',resourceUri:'a'},
 resetSelectedExcerpt(){context.selectedExcerpt=null;},excerptNotice:(...args)=>notices.push(args),request:async(method,params)=>{calls.push({method,params});return{};}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/selection-comments.js','utf8'),context);
const run=code=>vm.runInContext(code,context);context.openQuickExcerptComment=entry=>{context.stagedEntry=entry;run('excerptComments.push({...stagedEntry,id:++excerptCommentNext})');context.showExcerptComments(true);};const inputs=()=>elements['excerpt-comment-list'].querySelectorAll('textarea');
function select(text='first <script> excerpt',uri=context.activeFile.resourceUri){context.selectedExcerpt={text,name:uri+'.md',uri,range:{marker:uri}};}
async function main(){
 select();context.commentSelectedExcerpt();assert.equal(calls.length,0);assert.equal(run('excerptComments.length'),1);assert.equal(elements['excerpt-comment-dialog'].hidden,false);
 inputs()[0].value='解释这一段，不修改源文件';await inputs()[0].emit('input');context.closeExcerptComments();assert.equal(run('excerptComments.length'),1);assert.equal(elements['excerpt-comments-open'].textContent,'批注 1');
 context.activeFile={path:'C:/test/b.md',resourceUri:'b'};select('second quote');context.commentSelectedExcerpt();assert.equal(run('excerptComments.length'),2);assert.equal(inputs()[0].value,'解释这一段，不修改源文件','comments survive re-render and a different source file');
 inputs()[1].value='second comment';await inputs()[1].emit('input');
 let finish;context.request=async(method,params)=>{calls.push({method,params});return new Promise(resolve=>finish=resolve);};
 const sending=context.sendExcerptComments();await context.sendExcerptComments();assert.equal(calls.length,1,'one explicit send only');
 assert.equal(calls[0].method,'ui/message');assert.equal(calls[0].params._meta['openai/message'].send,false);assert.equal(calls[0].params._meta['openai/message'].target,'active');
 assert.equal(calls[0].params.content.length,2);assert.match(calls[0].params.content[0].text,/C:\/test\/a.md/);assert.match(calls[0].params.content[0].text,/<script> excerpt/);assert.match(calls[0].params.content[0].text,/解释这一段/);
 assert.match(calls[0].params.content[1].text,/second comment/);assert.equal(inputs()[0].readOnly,true);
 context.closeExcerptComments();assert.equal(elements['excerpt-comment-dialog'].hidden,false,'cannot drop pending batch');finish({});await sending;
 assert.equal(run('excerptComments.length'),0);assert.equal(elements['excerpt-comments-open'].hidden,true);
 select();context.commentSelectedExcerpt();context.request=async()=>{throw Error('offline');};await context.sendExcerptComments();assert.equal(run('excerptComments.length'),1);assert.match(elements['excerpt-comment-status'].textContent,/仍保留/);
 context.selectionDraftAvailable=false;context.updateExcerptCommentActions();assert.equal(elements['excerpt-comments-send'].disabled,true);await context.sendExcerptComments();assert.equal(calls.length,1);
 context.selectionDraftAvailable=true;context.closeExcerptComments();const before=run('excerptComments.length');select('stale','old');context.commentSelectedExcerpt();assert.equal(run('excerptComments.length'),before);
 let nativeCalls=0;document.oai={annotation:{request:()=>{nativeCalls++;return{accepted:true};}}};select();context.commentSelectedExcerpt();assert.equal(nativeCalls,0,'always keep comments in the plugin so native acknowledgement cannot suppress bubbles');assert.equal(run('excerptComments.length'),before+1);
 delete document.oai;context.closeExcerptComments();select('x'.repeat(20001));context.commentSelectedExcerpt();assert.equal(run('excerptComments.length'),before+1);assert.match(notices.at(-1)[0],/2 万/);
 context.showExcerptComments();inputs()[0].value='x'.repeat(5001);await inputs()[0].emit('input');await context.sendExcerptComments();assert.match(elements['excerpt-comment-status'].textContent,/5000/);
 await window.emit('pagehide');assert.equal(run('excerptComments.length'),0);assert.equal(elements['excerpt-comment-list'].children.length,0);
 console.log('PASS: per-quote comments and source snapshots, multi-file staging, explicit draft-only batch, duplicate guard, busy retention, failure/no-capability retention, stale selection, native capability fallback, size bounds and teardown');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
