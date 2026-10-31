# 安装与维护

[文档首页](README.md) · [English](installation.en.md) · [Linux / SSH](linux-ssh-installation.md) · [遇到问题](troubleshooting.md)

## 先选运行环境

| 环境 | 使用哪份说明 |
| :--- | :--- |
| 电脑上运行 Codex，文件和 Python 也在同一台 Windows 电脑 | 继续阅读下方 Windows 步骤 |
| 电脑上的 Codex 连接 Linux 服务器，浏览服务器文件 | [Linux / SSH 安装](linux-ssh-installation.md) |
| macOS、云端线程或其他宿主 | 先阅读[兼容性](compatibility.md)，当前未验证 |

## 准备条件

- **Python 3.12+**，以及支持 `codex plugin marketplace add` 和 `codex plugin add` 的 CLI。
- 桌面宿主支持本地插件、MCP App 文件入口和文件路径元数据。命令存在不等于桌面入口一定可用。
- 将源码放在长期保留的位置。构建会把 Python 和服务路径写入本机配置；移动源码、删除环境或更换机器后，需要重新构建并安装。

Markdown/图片核心功能使用 Python 标准库与随包提供的离线资源。Node.js 仅开发检查需要；PDF 有可选依赖。

## Windows 本机

在 PowerShell 中确认 Python 版本，再创建独立环境：

```powershell
python --version
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python -m venv .venv
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
```

也可下载源码归档并解压到稳定目录，然后从 `python -m venv .venv` 开始。已有源码时不要重复克隆到同一个目录。

在**仓库根目录**注册并安装：

```powershell
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

注册目标是包含 `.agents/plugins/marketplace.json` 的仓库根目录，不是 `plugins/`。应用中显示 **file-workspace**；命令保留兼容用的内部标识。

完整退出 Codex（包括托盘进程），重启并打开项目。右侧打开 Markdown，从文件标签的“打开”菜单选择 **file-workspace**。也可使用宿主提供的新标签插件入口；具体入口依版本而异。[第一次使用 →](usage.md)

> `doctor.py` 只检查，不自动安装软件或修改 Codex 设置。`built: true` 表示产物存在，不证明桌面界面已加载。

## 可选：PDF 预览

在刚才的同一个环境中安装依赖，再检查：

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-pdf.txt
.venv\Scripts\python.exe doctor.py
```

PDF 通过独立工作进程处理，需要 `pypdfium2` 和 `Pillow`。插件会优先选择存在的 Codex PDF Python 路径，否则使用构建时的 Python；以 `doctor.py` 输出的 `pdfPython` 和 `pdfAvailable` 为准。若选中了不合适的解释器，可在生成的 `.mcp.json` 服务 `env` 中设置 `FILE_WORKSPACE_PDF_PYTHON` 的绝对路径，随后重新安装。下一次构建会重建 `.mcp.json`，届时需要重新应用这一手动设置。

Linux 对应命令见 [Linux / SSH 指南](linux-ssh-installation.md#可选pdf-与开发检查)。PDF 以图片页面展示，当前不支持选文、OCR 或 PDF 批注。

## 升级

先保存文档并关闭旧标签；保留当前提交号 `git rev-parse HEAD` 和本机配置。使用原来的 Python 环境重新构建：

```powershell
git pull --ff-only
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
codex plugin add markdown-math-preview@markdown-preview-local
```

Linux 将 `.venv\Scripts\python.exe` 换为 `.venv/bin/python`。已有 `.runtime/server-env.json` 的构建会复用其中的项目/目录边界/headless 设置。更新遇到本地修改时先处理差异，不强制覆盖。

完整退出桌面端后重开；旧标签不会自动加载新的 HTML。同标识插件会被更新，不要同时注册多份来源。

## 回退

保留现有源码，在另一个稳定目录检出已知可用的提交或标签，重新构建后注册该来源并安装。先核对 `codex plugin marketplace list`，确保同一 marketplace 指向预期位置。不要使用 `git reset --hard` 丢弃修改。

插件版本回退不会自动还原文档。原文备份默认位于 `~/.codex/backups/file-preview/`；备份目录的自定义方式和访问边界见 [Linux 指南](linux-ssh-installation.md#目录边界与备份)。

## 卸载

保存并关闭插件标签后：

```powershell
codex plugin remove markdown-math-preview@markdown-preview-local
codex plugin marketplace remove markdown-preview-local
```

源码、Python 环境和文档备份不会被这两条命令删除。确认不再需要后再自行处理；保留有用的文档备份。

## 安装机制

`build.py` 将随包的 vendor 资源组合为离线 `viewer.html`，并生成只适合本机的 `.mcp.json`。GitHub 源码分发、本地插件注册与官方插件目录上架是不同步骤；本仓库不表示已通过官方目录审核。机制参考 [OpenAI 官方插件说明](https://developers.openai.com/plugins/build/plugins)。

## 新对话的默认项目

已有对话优先使用它自己的项目关联和工作目录。尚未发出首条消息的新对话，在宿主没有提供项目关联时，启动页仅在首次查询读取桌面端当前选中的本地项目，按项目根目录顺序展开文件树。该兼容信息是全局状态：多窗口同时切换项目时可能不对应当前窗口，可从项目菜单改选。载入成功后不会跟随全局项目变化；手动选择文件或文件夹会取消自动加载。

如果项目关联延迟到达，启动页最多追加四次查询，之后停止轮询。空白状态下可点击文件树刷新重新查询对话项目，但不会重新读取全局选中项目；需要改选时使用项目菜单。

Linux / SSH 继续优先使用服务器对话关联或明确配置的 `--project-root`。电脑上的项目选择状态不会自动传到服务器；此修复不意味着能在服务器识别所有桌面新对话的项目。升级需在服务器拉取源码、沿用原环境重新构建并安装，保留已有 `.runtime/server-env.json`。
