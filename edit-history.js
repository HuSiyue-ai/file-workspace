// 只记录源文快照；不从渲染后的 HTML 重建 Markdown。
class MarkdownEditHistory{
  constructor(){this.undoStack=[];this.redoStack=[];this.group=null;}
  record(text,key,position,now=Date.now()){
    if(!this.group||this.group.key!==key||now-this.group.time>650){
      this.undoStack.push({text,position});this.trim(this.undoStack);
    }
    this.group={key,time:now};this.redoStack=[];
  }
  trim(stack){let size=stack.reduce((n,item)=>n+item.text.length,0);while(stack.length>1&&(stack.length>60||size>8*1024*1024))size-=stack.shift().text.length;}
  step(direction,current,position){
    const from=direction==='undo'?this.undoStack:this.redoStack,to=direction==='undo'?this.redoStack:this.undoStack;
    if(!from.length)return null;to.push({text:current,position});this.trim(to);this.group=null;return from.pop();
  }
}
function replaceMarkdownRange(text,from,to,replacement){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>text.length)throw new Error('段落源文位置失效，请切换到源码模式继续编辑。');
  return text.slice(0,from)+replacement+text.slice(to);
}
