# Installation, updates and rollback

## 已验证环境

Windows 本地桌面环境，Python 3.12。其他系统与云端线程尚未验证。桌面宿主需要支持 MCP App 文件入口、文件路径元数据和插件目录。

## 为什么需要本地构建

`build.py` 将 vendor 内的资源组合为离线 `viewer.html`，并把当前 Python 的路径和插件目录写入 `plugins/markdown-math-preview/.mcp.json`。此文件只适用于当前安装位置，不提交 Git。

把仓库放到稳定目录后再构建；移动仓库、删除 Python 虚拟环境或换电脑后，需要重新构建和安装。Python 环境本身必须持续可用。

注册的是 **仓库根目录**（即含 `.agents/plugins/marketplace.json` 的目录），不是 `plugins/` 子目录。marketplace 中的 `source.path` 相对于仓库根目录解析。

## 安装

按 README 克隆、构建、检查和安装。也可下载源码 ZIP 解压后执行相同步骤（跳过 git clone）。核心构建不下载资源、不改 Codex 设置；注册/安装命令才修改插件配置。

显示名是 `file-workspace`。为保留已有文件关联，内部标识继续使用：

- plugin: `markdown-math-preview`
- marketplace: `markdown-preview-local`
- selector: `markdown-math-preview@markdown-preview-local`

已有同标识的本地旧版时，新安装会更新相同插件，不建议把两份来源同时注册。先保留旧来源和已知可用版本，确认新版本后再自行清理。

## PDF

`python doctor.py` 只检查，不安装软件或修改设置。如果 PDF 不可用，请在目标解释器中安装 `requirements-pdf.txt`。显式指定运行环境时，可在构建生成的 `.mcp.json` 的服务 `env` 中加入 `FILE_WORKSPACE_PDF_PYTHON`，值为解释器完整路径，随后重新安装并重启宿主。不要把自己的生成配置提交到仓库。

文件选择框打不开时，检查 Python 是否包含 Tkinter；仍可从宿主原生文件标签的“打开”菜单进入。

## 升级

先保存正在编辑的文档，再关闭旧标签；记录 `git rev-parse HEAD` 或保留旧版副本。更新源码后：

```powershell
git pull --ff-only
python build.py
codex plugin add markdown-math-preview@markdown-preview-local
```

完整退出宿主（包括托盘）后重开。旧标签不会自动换成新 HTML。

## 回退

在源码副本中切到之前验证过的提交或标签，重新执行构建和安装，再完整重启。请不要用 `git reset --hard` 丢弃自己的改动；可在另一目录检出旧版。文档保存备份与插件源码回退是两件事，备份不会因版本回退而自动覆盖原文。

## 卸载

先保存并关闭插件标签，再运行：

```powershell
codex plugin remove markdown-math-preview@markdown-preview-local
codex plugin marketplace remove markdown-preview-local
```

卸载不会替你删除源码副本或 `~/.codex/backups/file-preview/` 中的文档备份。确认不再需要后自行清理。

安装和 marketplace 布局依据 [OpenAI 官方插件打包说明](https://developers.openai.com/plugins/build/plugins)。GitHub 源码分发与 OpenAI 官方插件目录上架是不同的流程；本仓库不表示已经通过官方目录审核。
