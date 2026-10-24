# README visuals

本页记录 README 配图的来源与演示内容，便于区分概念插画和真实功能界面。

## 实际功能截图

截图使用发布仓库中构建的 `viewer.html`、真实本地 MCP 后端和虚构的 [Atlas Lab 示例项目](../examples/atlas-lab/README.md)，通过只监听本机的隔离演示宿主加载。截图中的自定义外框属于演示宿主，不是 Codex 原生标签栏。

所有操作均在真实查看器上完成；没有用 AI 生成界面，也没有添加产品中不存在的控件。聊天草稿请求由演示宿主截获，不进入真实对话。示例中的实验数据与结论均为虚构，不作为研究证据。

| 图片 | 实际演示的状态 |
| :--- | :--- |
| `01-file-tree.png` | 多个目录分支展开，当前文件选中，正文和目录并排 |
| `10-outline.png` | Markdown 标题层级全部展开，当前章节高亮 |
| `02-block-editing.png` | 编辑模式下仅当前段显示源码，其他块继续渲染 |
| `05-comments.png` | 第一段的确认气泡，第二段的评论输入框 |
| `03-math-detail.png` | KaTeX 行内公式、矩阵、下括号和分式 |
| `04-mermaid.png` | Mermaid 分支图与实际缩放控件 |
| `06-image-viewer.png` | 本地 WebP 图片适应窗口、尺寸与格式信息 |
| `07-pdf-search.png` | PDF 中搜索 `runtime`，显示命中高亮和书签 |
| `08-csv-filter.png` | 48 行记录按“低纹理”筛选后剩余 12 行 |
| `09-code.png` | Python 源码及中文注释的只读高亮 |

完整画面使用默认浏览器视口截图；公式、流程图、评论与代码使用原始像素局部特写，减少 GitHub 缩小显示后文字过小的问题。截图以 PNG 保存，不做有损压缩、伪造或重绘。原始尺寸可点击 README 图片查看。

## AI 插画

- `images/showcase/cover.webp`：ImageGen 生成的概念封面，表现文件、目录、公式和图片围绕同一工作台组织的想法，不代表软件实际界面。
- `examples/atlas-lab/figures/alpine-lake.webp`：ImageGen 生成的山水样图，只用于演示本地图片查看和缩放，不宣称拍摄于真实地点。

两项均使用内置 ImageGen 工具生成，转换为无损 WebP 保存，没有缩小分辨率。完整生成提示词见 [artwork-prompts.md](artwork-prompts.md)。
