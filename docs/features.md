# 功能与界面

[文档首页](README.md) · [English](features.en.md) · [开始使用](usage.md)

以下画面来自虚构的 Atlas Lab 演示项目。截图展示真实查看器，外框由隔离演示宿主提供；它不代表 SSH 桌面端已完成验收。[配图来源](visuals.md)。

## 浏览项目

### 文件树：连续切换，保留上下文

打开项目后，笔记、数据、图片和报告并排出现在目录中。单击文件即可在**当前预览页**切换，目录的展开状态、宽度与位置会在本次页面中保留。

<p align="center"><a href="images/showcase/retina/01-tree-2x.jpg"><img src="images/showcase/frames/01-tree.svg" alt="文件树近景：展开笔记分支，区分 Markdown、数据与文件夹图标" width="340"></a></p>

- **单击文件夹**展开 / 收起，**双击文件夹**进入；用 `↑` 返回上级，用定位按钮找到当前文件。
- 从项目下拉菜单切换根目录；按已加载的名称筛选文件，不扫描整个磁盘。
- 拖动左边界调整目录宽度，收起目录后正文恢复全宽，两侧独立滚动。
- 右键文件可复制路径、加入聊天或交给宿主打开；右键文件夹可新建子文件夹。双击文件同样交给宿主处理。

### 文章大纲：按结构阅读长文

文件树回答“资料在哪里”，大纲回答“这篇文档讲到哪里”。点击「大纲」，标题按层级展开；点击标题直接跳转到相应位置。

<p align="center"><a href="images/showcase/retina/10-outline-2x.jpg"><img src="images/showcase/frames/10-outline.svg" alt="文章大纲：多级标题展开、章节定位和当前阅读位置" width="340"></a></p>

- 保留 Markdown 的标题层次，可单独展开章节，也可全部展开 / 折叠。
- 当前阅读位置随正文滚动更新，长篇报告不必反复拖动滚动条。
- 大纲与文件树共用可调整宽度的侧栏，随时切换或收起。

## 编辑与讨论

### 块编辑：只展开正在修改的那一段

「阅读」模式锁定内容，适合选文与浏览。切到「编辑」后，点击一个段落、列表或代码块，只展开该块的 Markdown 源码；周围的标题、公式和图片继续保持渲染。

<p align="center"><a href="images/showcase/retina/02-editor-2x.jpg"><img src="images/showcase/frames/02-editor.svg" alt="块编辑近景：当前段落显示加粗与行内公式源码，下方公式保持渲染" width="600"></a></p>

1. 在模式菜单选择「编辑」，点击需要修改的块；普通文字和代码尽量按点击位置放置光标。
2. 修改文本后，点击其他块；上一块恢复排版，新一块展开源码。
3. 需要调整整篇结构时，切换到「源码」模式；支持撤销 / 重做。
4. 点击「保存」或按 `Ctrl+S` 才写回文件。外部修改冲突会阻止覆盖，保存前会备份原文件。

图示可见 `**预测位置**` 与 `$e$` 的源码，以及仍保持排版的块级公式。支持编辑已有的 UTF-8 `.md` / `.markdown` 文档。

### 选区评论：把问题放在对应的段落旁

引用和自己的意见可以分开写，也可以收集多段后一起加入对话。确认过的评论显示为编号气泡，点击可回来修改。

<p align="center"><a href="images/showcase/retina/05-comments-2x.jpg"><img src="images/showcase/frames/05-comments.svg" alt="选区评论特写：第一段的编号气泡，以及第二段旁的简洁评论输入框" width="600"></a></p>

1. 选中文字，点「评论…」，在小输入框中补充问题或修改要求。
2. 点 `✓` 确认，段落旁保留编号气泡；也可继续选择下一段。
3. 顶部「批注 N」打开汇总面板，逐条修改评论或移除引用。
4. 点「加入聊天草稿」，引用与对应评论一起进入当前对话，**不会自动发送**。

评论暂存在当前标签内存中，关闭标签会清除；它不是写入 Markdown 的永久批注，也不等同于宿主原生评论卡片。

## 多格式阅读

### 公式：让推导回到正文中

行内公式跟着句子走，块级公式独立排版。矩阵、分式、积分和上下标都由本地 KaTeX 渲染，不必把推导拆成图片。

<p align="center"><a href="images/showcase/retina/03-math-2x.jpg"><img src="images/showcase/frames/03-math.svg" alt="公式特写：文字混排、状态转移矩阵与下括号" width="600"></a></p>

- 支持 `$...$` 行内公式与 `$$...$$` 块级公式。
- 可以在段落、列表、引用和表格中混排公式。
- 编辑时仍修改原始 Markdown / LaTeX 源码，渲染结果不替换原文。

试用：[公式笔记](../examples/atlas-lab/notes/equations.md)。

### 流程图：内嵌正文，放大看细节

Mermaid 代码块直接变成文档中的图，不需要另外弹出一个绘图窗口。图上方可缩放，图下方继续阅读解释。

<p align="center"><a href="images/showcase/retina/04-mermaid-vector.svg"><img src="images/showcase/frames/04-mermaid.svg" alt="Mermaid 原生矢量图：带条件分支的彩色数据流水线" width="600"></a></p>

- 悬停或聚焦图表后显示 `−` / `+` / 重置按钮。
- 按住 `Ctrl` / `⌘` 并滚动滚轮缩放，放大后按住拖动。
- 缩放保持原有占位高度，不把后面的正文顶走。
- 阅读显示图形；编辑与源码模式仍可修改 Mermaid 定义。解析失败时保留源码供排查。

试用：[数据流水线](../examples/atlas-lab/notes/pipeline.md)。

### 图片：从完整构图到局部细节

同一工作台可以直接查看图片。先适应窗口看全貌，再放大检查截图、图表或照片中的细节。

<p align="center"><a href="images/showcase/retina/06-images-2x.jpg"><img src="images/showcase/frames/06-images.svg" alt="图片查看器：山水样图完整显示，工具栏提供比例、缩放、适应窗口和原始大小" width="600"></a></p>

- 滚轮围绕鼠标位置缩放，放大后按住拖动；工具栏支持 `−` / `+`、适应窗口与原始大小。
- 双击切换适应窗口 / 原始大小；聚焦图片区域后可用键盘缩放和平移。
- 显示像素尺寸与格式；PNG、JPEG、GIF、WebP、SVG、BMP、ICO、AVIF 的实际解码取决于宿主。
- Markdown 嵌图支持本地相对路径、中文与空格路径、引用式图片和 Obsidian 图片语法。

图中的[山水样图](../examples/atlas-lab/figures/alpine-lake.webp)由 AI 生成，仅作为图片查看器的演示素材。

### PDF：读报告、查关键词、跳书签

从文件树点开 PDF，仍在同一个页面中阅读。支持页码跳转、不同缩放比例、书签和跨页文字搜索。

<p align="center"><a href="images/showcase/retina/07-pdf-2x.jpg"><img src="images/showcase/frames/07-pdf.svg" alt="PDF 查看器：虚构报告、跨页 runtime 搜索与命中高亮" width="600"></a></p>

- 上一页 / 下一页或输入页码跳转，选择适应宽度或固定缩放比例。
- 在搜索框输入关键词，查看命中页并跳转，页面内显示对应高亮。
- 点「大纲」查看 PDF 自带书签，按章节定位。
- 通过独立 PDF 进程渲染；需要可选依赖 `pypdfium2` 与 `Pillow`。

试用：[虚构实验报告](../examples/atlas-lab/reports/benchmark-report.pdf)。当前 PDF 以图片页面显示，暂不支持选文、OCR、表单填写与 PDF 批注。

### CSV / TSV：先筛选，再阅读

实验记录或导出的数据表，不必先打开电子表格软件。工作台按列展示，支持筛选、分页和原文切换。

<p align="center"><a href="images/showcase/retina/08-csv-2x.jpg"><img src="images/showcase/frames/08-csv.svg" alt="CSV 表格近景：从 48 条虚构记录中筛选待复核项目，保留表头与行号" width="600"></a></p>

- 输入关键词筛选当前载入的表格，保留原始行号，便于回查。
- 可切换首行是否作为表头，按页阅读较长数据。
- 在「表格」与「原文」之间切换，检查分隔与原始内容。
- 这是只读预览，不修改单元格、不运行公式；超出行列与大小限制时会提示。

试用：[48 条实验记录](../examples/atlas-lab/data/benchmark.csv)，数据均为虚构示例。

### 代码：高亮阅读，保持只读

查看文档时顺手点开实现文件，函数、字符串、注释与关键字通过语法高亮区分。

<p align="center"><a href="images/showcase/retina/09-code-2x.jpg"><img src="images/showcase/frames/09-code.svg" alt="代码特写：Python 数据类、类型标注与中文文档字符串" width="560"></a></p>

- 按文件类型识别支持的语言；普通 UTF-8 文本可直接查看。
- 高亮资源随插件打包，运行时不请求 CDN。
- 只读取文本，不运行代码；代码文件编辑可交给外部编辑器。
- Notebook 当前显示 JSON 原文，Office、音视频等交给宿主打开。

试用：[Python 示例](../examples/atlas-lab/src/reconstruct.py)。
