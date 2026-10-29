<div align="center">

<img src="docs/images/wordmark.svg" alt="file-workspace — Read. Edit. Explore." width="720">

<p><strong>在 Codex 右侧浏览项目、编辑 Markdown，把引用和问题一起带进对话。</strong></p>
<p>公式 · Mermaid · 图片 · PDF · 代码 · CSV / TSV</p>

<p>
<a href="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml"><img src="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml/badge.svg?branch=main" alt="Linux / Windows checks"></a>
<a href="https://github.com/HuSiyue-ai/file-workspace/releases/tag/v1.9.0-linux.1"><img src="https://img.shields.io/badge/Linux%20%2F%20SSH-preview-7561c7" alt="Linux / SSH preview"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16836a" alt="MIT License"></a>
</p>

<p><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
<p><a href="#开始安装">开始安装</a> · <a href="docs/features.md">功能与截图</a> · <a href="docs/usage.md">使用指南</a> · <a href="docs/troubleshooting.md">常见问题</a> · <a href="https://github.com/HuSiyue-ai/file-workspace/releases">下载与版本</a></p>

</div>

<p align="center"><a href="docs/features.md"><img src="docs/images/showcase/retina/02-editor-2x.jpg" alt="真实查看器：只展开当前段落的 Markdown 源码，下方公式保持渲染" width="720"></a></p>
<p align="center"><sub>真实查看器的块编辑近景。来自隔离演示宿主；<a href="docs/visuals.md">配图来源与验证边界</a>。</sub></p>

## 一个文件树，接着读、接着改

| 浏览项目 | 阅读资料 | 编辑与讨论 |
| :--- | :--- | :--- |
| 文件树按层展开，单击切换文件；文章大纲定位章节。 | 公式排版、流程图缩放、图片放大、PDF 搜索、表格筛选。 | 段落就地编辑或查看整篇源码；手动保存；选区评论加入聊天草稿。 |

Markdown 支持 UTF-8 `.md` / `.markdown` 的阅读与编辑；代码、表格和 PDF 提供只读预览。批注保留在当前标签中，加入聊天时先进入草稿，不会自动发送。[查看全部功能与截图 →](docs/features.md)

## 开始安装

需要 **Python 3.12+** 和支持 `codex plugin` 的 CLI。Markdown/图片的核心运行不需要 Node.js，也不需要安装第三方 Python 包。将源码和 Python 环境放在准备长期保留的位置，**在运行插件的那台机器上构建**。

| 你的环境 | 安装入口 | 当前验证状态 |
| :--- | :--- | :--- |
| Windows 本机 + Codex 桌面端 | [Windows 安装](docs/installation.md#windows-本机) | 主要桌面验证环境；Windows CI 通过。 |
| Linux / SSH 服务器 + 电脑桌面端 | [Linux / SSH 安装](docs/linux-ssh-installation.md) · [预览版下载](https://github.com/HuSiyue-ai/file-workspace/releases/tag/v1.9.0-linux.1) | 服务器后端和 Linux CI 通过；桌面 SSH 入口及右侧渲染待人工验收。 |
| macOS / 云端线程 / 其他宿主 | [兼容性说明](docs/compatibility.md) | 尚未验证；请先核对宿主能力。 |

<details>
<summary><strong>Windows 快速安装 · PowerShell</strong></summary>

```powershell
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python -m venv .venv
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

`python --version` 必须为 3.12+。完整退出 Codex（含托盘）再重启，在右侧文件标签的“打开”菜单选择 **file-workspace**。[完整步骤与可选 PDF →](docs/installation.md)

</details>

<details>
<summary><strong>Linux / SSH 快速安装 · Bash</strong></summary>

```bash
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python3.12 -m venv .venv
.venv/bin/python build.py \
  --project-root /absolute/path/to/project \
  --allowed-root /absolute/path/to/project \
  --headless
.venv/bin/python doctor.py
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

将示例路径替换为已有的服务器项目目录，以 SSH 登录用户操作，无需 `sudo`。完整退出电脑上的 Codex，再重连同一 SSH 项目；从服务器文件标签的“打开”菜单选择 **file-workspace**。服务器安装成功与桌面入口可用需要分别验证。[完整步骤与验收清单 →](docs/linux-ssh-installation.md)

</details>

应用显示名是 **file-workspace**；安装命令保留内部标识 `markdown-math-preview@markdown-preview-local`。本仓库提供需要本机构建的源码，不是粘贴 GitHub 地址就能直接使用的远程服务。

## 安装后，从这里开始

1. **打开文档**：右侧打开一个 Markdown，在“打开”菜单选择 **file-workspace**；随后从文件树连续切换文件。
2. **试一次编辑**：复制一份[示例笔记](examples/atlas-lab/notes/methods.md)，进入“编辑”或“源码”模式，修改一句话，按 `Ctrl+S` 保存并刷新确认。
3. **体验其他格式**：打开[Atlas Lab 演示项目](examples/atlas-lab/README.md)，试用公式、流程图、本地图片、PDF 和表格。PDF 需要[可选依赖](docs/installation.md#可选pdf-预览)。

[完整使用指南 →](docs/usage.md) · [找不到插件或图片不显示 →](docs/troubleshooting.md)

## 文件与保存

- **本地处理**：查看器资源随插件打包；不拉取网络嵌图，不执行文档中的代码。主动加入聊天的引用随后由 Codex 处理。
- **显式保存**：保存时校验文件版本并备份原文；外部修改冲突会阻止覆盖。内存草稿和批注不能代替文件备份。
- **可选目录边界**：`--allowed-root` 限制文件、目录、嵌图与保存的访问范围，拒绝解析后越界的路径；这是应用层检查。未配置时沿用同一磁盘边界，Linux 上范围可能很广。

[支持格式与大小限制](docs/limitations.md) · [平台与验证状态](docs/compatibility.md)

## 文档与反馈

| 想做什么 | 从这里进入 |
| :--- | :--- |
| 安装、升级、回退、卸载 | [安装指南](docs/installation.md) · [Linux / SSH](docs/linux-ssh-installation.md) |
| 了解功能与日常操作 | [功能图览](docs/features.md) · [使用指南](docs/usage.md) · [演示项目](examples/atlas-lab/README.md) |
| 解决问题、确认支持范围 | [常见问题](docs/troubleshooting.md) · [兼容性](docs/compatibility.md) · [格式限制](docs/limitations.md) |
| 参与开发、了解版本变化 | [贡献指南](CONTRIBUTING.md) · [架构](docs/architecture.md) · [更新记录](CHANGELOG.md) |

更多入口见[文档首页](docs/README.md)。反馈问题请使用 [Issues](https://github.com/HuSiyue-ai/file-workspace/issues)，附上系统、桌面/CLI/插件版本、操作步骤和虚构的最小样例。

[MIT](LICENSE) © HuSiyue-ai · [第三方声明](THIRD-PARTY-NOTICES.md) · [配图来源](docs/visuals.md)。这是独立项目，与 OpenAI 无隶属或背书关系。
