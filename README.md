# file-workspace

**在 Codex 右侧，浏览项目、阅读文档、就地编辑。**

A local file workspace for the Codex desktop sidebar, with one shared file tree for Markdown, math, Mermaid diagrams, images, PDF, code and CSV.

`file-workspace` 是面向 Codex 桌面端右侧栏的本地文件工作台。打开项目文件夹后，单击文件即可在当前页切换预览；阅读 Markdown、修改段落、放大图片、查看 PDF，以及把选中的内容和评论加入聊天草稿，都可以围绕同一棵文件树完成。

**当前版本：1.8.2 · 实验性个人项目 · Windows 优先验证 · MIT License**

![file-workspace preview](docs/images/workspace-preview.png)

## 为什么做这个项目

这个项目从日常阅读笔记和课程文档时的小问题开始：公式希望正确排版，图片希望能放大，切换文件希望保留目录，读到需要讨论的段落希望能直接带进对话。后来逐步加入块编辑、流程图、PDF 和表格预览，形成了现在的工作台。

设计上尽量沿用内置文件管理器的操作习惯：文件树与正文并排、边界可拖动、收起后正文恢复全宽；单击文件切换预览，双击交给宿主打开。Markdown 默认只读，进入编辑模式后，点击某一块才展开对应源码，离开该块恢复排版，修改后由用户手动保存。

如果你经常一边与 Codex 对话，一边查看项目说明、学习笔记、代码或实验资料，可以从 [示例文档](examples/demo.md) 开始试用。

## 能做什么

- **一棵文件树**：单击文件原位预览，双击交给宿主打开；文件夹单击展开、双击进入，支持项目根目录切换、上级、定位、筛选、拖动栏宽和新建文件夹。
- **Markdown 阅读与编辑**：阅读时锁定；编辑时点击一个块展开源码，其他块保持排版；也可编辑整篇源码。手动保存、冲突检查、原文件备份和撤销/重做。
- **公式与图表**：KaTeX 行内/块级公式，Mermaid 直接内嵌正文；缩放和拖动不撑动图的占位高度。
- **图片**：独立图片缩放、拖动、适应窗口；Markdown 支持本地相对路径、中文/空格路径、引用式和 Obsidian 图片。
- **PDF / 代码 / 表格**：PDF 翻页、缩放、书签和文字搜索；离线代码高亮；CSV/TSV 分页、筛选和原文切换。
- **选区批注**：选文后添加评论，编号气泡可回改；确认后加入聊天草稿，不自动发送。

## 安装与开始使用

需要 Python **3.12+** 和支持本地插件 / MCP App 文件入口的 Codex 桌面环境。文件选择框需要 Tkinter。Node.js 只用于开发测试，日常预览不需要。

本项目采用**先本地构建，再注册本地 marketplace**的方式。构建会为安装者生成 Python 和服务器路径；不要直接把仓库地址当作开箱即用的远程插件源。

```powershell
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python build.py
python doctor.py
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

`codex` 必须是支持 `plugin` 子命令的 CLI，并已加入 PATH；也可以用其完整可执行文件路径替换。

安装后完整退出桌面应用（包括托盘），再重新启动：

1. 在右侧打开一个 Markdown / 图片等支持文件。
2. 在文件的“打开”菜单中选择应用内查看器 **file-workspace**。
3. 也可在新标签页的插件工具入口打开空白工作台，再从文件树单击选择文件。入口位置取决于宿主版本。
4. 先用 [examples/demo.md](examples/demo.md) 试用；编辑后点击“保存”或按 Ctrl+S 才写回文件。

[块编辑截图](docs/images/block-editing.png) · [完整安装、升级与回退说明](docs/installation.md) · [支持范围与限制](docs/limitations.md) · [设计与结构](docs/architecture.md)

## PDF 可选依赖

其他功能只需要 Python 标准库和仓库内前端资源。PDF 使用独立进程中的 `pypdfium2` 与 `Pillow`。

```powershell
python -m pip install -r requirements-pdf.txt
```

插件优先使用已有 Codex PDF 运行时，否则使用构建时的 Python；也可以设置 `FILE_WORKSPACE_PDF_PYTHON` 指向安装了该包的解释器。运行 `python doctor.py` 查看结果。

## 本地数据如何处理

预览资源和公式/图表/高亮库均在本地。插件不上传文件、不联网拉取图片，不执行文档代码。用户主动打开外部网页链接时会交给宿主。

保存前校验原文件版本，并备份到 `~/.codex/backups/file-preview/`。未保存草稿尝试存储在查看器本地存储；选区批注只保留在当前标签内存中。加入对话的引用会进入当前聊天草稿，由用户自行决定是否发送。

这是**本地文件访问工具**：当前文件/项目建立访问锚点，后端按需读取同一磁盘的支持文件，**不是限制在项目文件夹内的沙箱**。项目自动识别使用只读的宿主状态兼容适配；失效时可手动选择文件夹。[详细边界](docs/limitations.md)

## 开发与验证

```powershell
python -m pip install -r requirements-dev.txt
python check.py --require-pdf
```

检查需要 Node.js。`check.py` 覆盖 Python 文件/路径/保存/目录测试、MCP 握手、JavaScript 状态回归、Markdown 解析和 vendor 校验；PDF 依赖未安装时可去掉 `--require-pdf` 运行其他测试。

`python dev_preview.py` 启动只监听 `127.0.0.1` 的隔离界面。该页面截获聊天草稿请求，不向真实聊天发送消息；它用于 UI 调试，不能代替桌面宿主兼容性测试。

## 状态与贡献

已经过本地长期使用与多轮迭代，仍需更多机器和宿主版本验证。优先保证稳定性，欢迎提供最小复现。[贡献说明](CONTRIBUTING.md) · [更新记录](CHANGELOG.md)

由 **HuSiyue-ai** 基于实际使用场景设计、测试和维护，开发过程使用 AI 辅助。与 OpenAI 无隶属或背书关系。

项目代码使用 [MIT](LICENSE)；第三方组件保留各自许可证，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
