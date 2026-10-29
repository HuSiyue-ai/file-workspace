# 常见问题

[文档首页](README.md) · [English](troubleshooting.en.md) · [安装指南](installation.md) · [兼容性](compatibility.md)

## 插件安装了，右侧却没有入口

先在运行服务的那台机器上确认：

```bash
codex plugin marketplace list
codex plugin list --marketplace markdown-preview-local --json
```

检查 marketplace 指向预期的源码根目录，插件已安装且启用。然后保存工作、关闭旧标签、完整退出桌面端（含托盘），重启后新建聊天，在文件标签的“打开”菜单寻找 **file-workspace**。

SSH 场景需确认连接的是同一主机与用户，文件也是服务器上的文件。若仍无入口，记录桌面版本和菜单截图；可能是宿主未向远程环境暴露该入口，不能仅靠重复注册解决。

## 安装名为什么不是 file-workspace

**file-workspace** 是显示名。安装与卸载保留历史 selector：

```text
markdown-math-preview@markdown-preview-local
```

这不会安装另一个无关插件。

## Python 版本不够，或服务路径失效

需要 Python 3.12+。用独立用户/项目环境，不替换系统 Python。检查实际用于构建的解释器版本，并使用同一解释器运行 `doctor.py`。

移动源码、删除环境或从其他电脑复制 `.mcp.json` 都会使路径失效。重新在目标机器构建、安装，再完整重启桌面端。不要在编辑器中公开包含个人路径的生成配置。

## 无图形桌面，打不开选择文件夹弹窗

SSH 服务器使用 `build.py --project-root ... --allowed-root ... --headless`，其中路径为已有服务器目录；重新安装后从文件树打开内容。`tkinterAvailable: true` 仅表示模块存在，不代表有可用的图形会话。[Linux 完整步骤](linux-ssh-installation.md)

## 文件树没有项目，或显示了意外的目录

自动识别依赖当前聊天 ID 和服务主机上的状态。确认 `doctor.py` 输出的 `projectRoot`、`allowedRoot`、`headless` 是否符合预期。Linux/SSH 可显式设置后备项目根目录；优先匹配的当前聊天目录仍可覆盖后备值。不要用全局最近项目推断当前聊天。

## 图片不显示

检查图片是否确实嵌入当前 Markdown、相对路径是否以该文档为基准、文件是否存在且格式受支持。中文、空格、引用式和 Obsidian 图片语法均有支持，但大小与目录边界仍生效。

网络 URL、UNC/网络共享、未在文档引用的图片或解析后越界的链接会被拒绝。本地挂载路径按本机路径处理，是否可读仍取决于权限与配置。详情见[格式限制](limitations.md)。

## PDF 不可用

将 `requirements-pdf.txt` 安装到实际使用的 PDF Python 环境。以 `doctor.py` 的 `pdfPython`、`pdfAvailable` 为准；不要仅检查当前终端的 `pip`。覆盖解释器的方法见[PDF 安装](installation.md#可选pdf-预览)。

PDF 当前按图片页面显示，没有选文、OCR、表单或 PDF 批注。

## 保存被拒绝，或改动没有写进文件

保存仅支持已有 UTF-8 Markdown。输入不会自动写盘，请点击“保存”或按 `Ctrl+S`。若提示被其他程序修改，先保留自己的草稿，再刷新并编辑最新版本，避免覆盖外部改动。

备份默认位于 `~/.codex/backups/file-preview/`，也可能由 `FILE_WORKSPACE_BACKUP_ROOT` 指定。内存批注和未保存草稿不会成为永久文件备份。

## 更新后看起来还是旧版

确认在原来源根目录重新构建并执行了 `codex plugin add markdown-math-preview@markdown-preview-local`。旧标签保留旧 HTML；保存后关闭它们，完整退出宿主再重开。避免同名 marketplace 指向另一份旧源码。

## 如何反馈问题

通过 [GitHub Issues](https://github.com/HuSiyue-ai/file-workspace/issues) 提供：系统和本地/SSH 场景、桌面/CLI/Python/插件版本、复现步骤、预期与实际结果，以及虚构的最小文件。可附裁剪后的截图；不要上传真实私密文档、令牌或完整环境变量。
