const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
async function main(){
 const {markdownHtml}=await import(pathToFileURL(__dirname+'/markdown-parser.mjs'));
 const {Marked}=await import(pathToFileURL(__dirname+'/vendor/marked.mjs'));
 const strong=[
  ['**输入证据可能不足。**有些案例','输入证据可能不足。'],
  ['前文**输入证据可能不足。**后文','输入证据可能不足。'],
  ['**背景与问题：**正文','背景与问题：'],
  ['**注意:**正文','注意:'],
  ['前文**（注意）**后文','（注意）'],
  ['**“中文”**后文','“中文”'],
  ['**中文。**后文**第二段！**结尾','第二段！'],
  ['𠀀**中文。**后文','中文。'],
  ['**日文です。**日本語','日文です。'],
  ['**한국어입니다.**한국어','한국어입니다.'],
  ['__中文。__后文','中文。'],
 ];
 for(const [source,text] of strong)assert(markdownHtml(source).includes('<strong>'+text+'</strong>'),source);
 let html=markdownHtml('**中文 *斜体*。**后文');assert.match(html,/<strong>中文 <em>斜体<\/em>。<\/strong>后文/);
 html=markdownHtml('***中文！***后文');assert.match(html,/<strong>/);assert.match(html,/<em>/);
 html=markdownHtml('中文**`code`**后文');assert.match(html,/<strong><code>code<\/code><\/strong>/);
 html=markdownHtml('**[链接](https://example.com)**后文');assert.match(html,/<strong><a href="https:\/\/example.com">链接<\/a><\/strong>/);
 html=markdownHtml('**公式 $E=mc^2$。**后文');assert.match(html,/<strong>公式 /);assert.match(html,/class="katex"/);assert(!html.includes('katex-error'));
 for(const source of ['`**中文。**后文`','```md\n**中文。**后文\n```','    **中文。**后文','\\*\\*中文。\\*\\*后文','** 中文**','**中文 **','$x^{2}$'])assert(!markdownHtml(source).includes('<strong>'),source);
 // English delimiter behavior and literal operators retain the bundled parser's output.
 const standard=new Marked({gfm:true});
 for(const source of ['**bold** text','text**bold**next','**bold.**next','foo_bar_baz','a * b ** c','***nested***','**bold _italic_**','\\**literal**','<https://example.com/**x**>','**a `**` b**']){
  const actual=markdownHtml(source).replace(/<div class="markdown-block"[^>]*>/g,'').replace(/<\/div>/g,'');
  assert.equal(actual,standard.parse(source),source);
 }
 const source='# 标题\n\n前文**中文。**后文\n\n- **列表！**紧接正文\n\n> **引用：**正文\n\n|列|\n|---|\n|**表格。**后文|\n';
 html=markdownHtml(source);assert.equal((html.match(/<strong>/g)||[]).length,4);
 const blocks=[...html.matchAll(/data-source-from="(\d+)" data-source-to="(\d+)"/g)];let offset=0;
 for(const block of blocks){assert.equal(Number(block[1]),offset);offset=Number(block[2]);}assert.equal(offset,source.length,'source positions preserved without inserted spaces');
 console.log('PASS: CJK punctuation/adjacency, nested inline formatting/math, code and escape isolation, English behavior and unchanged source offsets');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
