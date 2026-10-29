# Linux / SSH 安装

[文档首页](README.md) · [English](linux-ssh-installation.en.md) · [兼容性](compatibility.md) · [常见问题](troubleshooting.md)

**当前提供 Linux/SSH 预览版。** 服务器后端与 Linux/Windows 自动检查通过，电脑桌面端的 SSH 插件发现、菜单和实际右侧渲染仍需人工验收。[下载 v1.9.0-linux.1](https://github.com/HuSiyue-ai/file-workspace/releases/tag/v1.9.0-linux.1)

## 1. 准备服务器环境

需要 Python **3.12+**，以及支持以下命令的 Codex CLI（实测版本 0.162.1）：

```bash
python3.12 --version
codex --version
codex plugin marketplace add --help
codex plugin add --help
```

如果默认 Python 较旧，为当前用户安装独立的 3.12+ 解释器；不要替换系统 Python。将源码与环境保存在长期保留的位置，全程使用 SSH 登录用户，不使用 `sudo`。

桌面宿主需要能发现 SSH 主机上的插件并转发 MCP App 文件/聊天入口。下面的服务器操作无法单独证明这一能力。[具体验证状态](compatibility.md)

## 2. 获取源码并核验下载

可以克隆仓库，也可以从 Release 下载 Linux 源码包。使用 Git：

```bash
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
```

使用 Release 时，将源码包与 `SHA256SUMS.txt` 放在同一目录，执行：

```bash
sha256sum -c SHA256SUMS.txt
tar -xzf file-workspace-1.9.0-linux.1-linux-source.tar.gz
cd file-workspace-1.9.0-linux.1
```

应看到校验结果 `OK`。解压目标应为尚不存在的新目录；包内包含离线 vendor 资源和许可证，不包含 Python、已生成插件或本机配置。

## 3. 在服务器构建

从源码根目录创建独立环境，配置项目根目录和访问边界：

```bash
python3.12 -m venv .venv
.venv/bin/python build.py \
  --project-root /absolute/path/to/project \
  --allowed-root /absolute/path/to/project \
  --headless
.venv/bin/python doctor.py
```

把示例路径替换为**已有的服务器项目绝对路径**。`--project-root` 必须位于 `--allowed-root` 内；只有需要浏览多个项目时，才将允许目录设为它们共同的父目录。

| 参数 | 作用 |
| :--- | :--- |
| `--project-root` | 宿主未提供可解析的聊天目录时，使用这个明确配置的项目入口 |
| `--allowed-root` | 限制文件、目录、嵌图和保存的访问范围 |
| `--headless` | 禁用 Tkinter 文件/目录选择弹窗，使用项目文件树 |

设置保存在忽略的 `.runtime/server-env.json` 中，之后不带参数的构建会复用它们。`.mcp.json` 使用这台服务器的 Python 和服务路径；不要复制 Windows 构建产物。源码或 Python 位置改变后需重新构建并安装。

项目识别优先使用宿主当前聊天 ID 对应的服务器状态，并遵循 `CODEX_HOME`；不能识别时使用配置的根目录，不猜测进程工作目录。

## 4. 注册到当前用户

在源码根目录执行：

```bash
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
codex plugin list --marketplace markdown-preview-local --json
```

确认 `installed: true`、`enabled: true`。显示名为 **file-workspace**，命令中使用旧内部标识。请保留源码目录与 Python 环境，服务命令会持续引用它们。

## 5. 在电脑桌面端验收

1. 保存已有工作并关闭旧插件标签，完整退出 Codex（含托盘），重启。
2. 重新连接同一个 SSH 主机、用户与项目；新建聊天以刷新插件发现。
3. 右侧打开服务器的 `examples/welcome.md`；从文件标签的“打开”菜单选择 **file-workspace**。宿主若提供新标签插件入口，也可从那里进入项目树。
4. 核对文件树是服务器路径，正文、公式和引用的本地图片可见；使用文件树切换文件，不调用服务器图形弹窗。
5. 将示例复制为项目内的新测试文档，修改一句话，按 `Ctrl+S` 保存；刷新并检查服务器文件，确认修改保留。

找不到菜单时，记录桌面版本、SSH 项目状态和截图。不要把服务器 Python 路径注册为电脑本机执行的命令。[排查入口](troubleshooting.md)

## 目录边界与备份

配置 `--allowed-root` 后，父目录越界与解析到边界外的符号链接会被拒绝；文件树跳过符号链接。它是应用层路径检查，不是操作系统沙箱，也不能防止并发修改文件系统造成的竞态。未配置时沿用同一磁盘边界，在 Linux 上范围可能很广。

显式保存会先比较 SHA-256 版本，再备份原文并替换目标。默认备份目录是当前用户的 `~/.codex/backups/file-preview/`。若需自定义，可在 `.runtime/server-env.json` 中设置 `FILE_WORKSPACE_BACKUP_ROOT` 为持久、私有目录，重新构建和安装。文档备份不要按缓存自动删除。

## 可选：PDF 与开发检查

仅使用 PDF 预览时：

```bash
.venv/bin/python -m pip install -r requirements-pdf.txt
.venv/bin/python doctor.py
```

完整开发回归需要 Node.js 和测试依赖：

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
FILE_WORKSPACE_PDF_PYTHON="$PWD/.venv/bin/python" .venv/bin/python check.py --require-pdf
```

首轮服务器安装验证了真实 stdio 服务、离线 UI 资源、聊天项目识别、本地 SVG/PNG、临时文档保存/备份和冲突保护。随后发布检查包含 PDF，并在 Linux/Windows CI 通过。它们均不能代替实际桌面端 SSH 界面验收。[完整验证记录入口](compatibility.md)

[升级、回退与卸载 →](installation.md#升级) · [开始使用 →](usage.md)
