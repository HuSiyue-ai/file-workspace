# 兼容性与验证状态

[文档首页](README.md) · [English](compatibility.en.md) · [安装](installation.md) · [排查问题](troubleshooting.md)

此页区分源码检查、服务实测和桌面宿主验收。**CLI 安装成功、CI 通过或测试宿主能渲染，都不能单独证明真实桌面端入口可用。**

## 平台状态

| 环境 | 已有证据 | 尚需核验 |
| :--- | :--- | :--- |
| Windows 本机桌面 | 仓库主要桌面验证环境；查看器功能有演示；Windows Python/Node/PDF CI 通过 | 未逐一覆盖所有桌面应用版本与权限配置 |
| Linux / SSH | Ubuntu 22.04 x86_64、Python 3.12.14、CLI 0.162.1 的真实 stdio 服务及文件操作通过；Linux CI 通过 | 电脑桌面端远程插件发现、右侧菜单、实际公式/图片渲染与交互保存 |
| Linux 有图形桌面 | Python 后端及显式 headless 配置可检查 | Tkinter 本机选择框与完整桌面流程未验证 |
| macOS / 云端线程 / 其他宿主 | 没有完成相应端到端验证 | 宿主插件机制、入口、路径、权限和完整流程 |

## 已完成的 Linux 验证

- 以服务器登录用户注册，使用服务器本地生成的 Python 与插件路径。
- 按已安装配置启动真实 MCP stdio 进程，完成握手、工具列表和离线 UI 资源读取。
- 根据当前真实聊天 ID 解析服务器项目；缺失元数据时，使用明确配置的项目根目录。
- 读取中文及空格路径的测试 Markdown、本地 SVG/PNG，并核对返回字节。
- 在专用测试文件上执行编辑、保存、备份和读回；陈旧版本拒绝覆盖。
- 拒绝目录边界外的请求；回归覆盖父目录与符号链接越界；headless 模式不启动 Tkinter。

首轮服务器安装没有验证 PDF；后续发布检查补齐 PDF 自动回归。`v1.9.0-linux.1` 的[发布工作流](https://github.com/HuSiyue-ai/file-workspace/actions/runs/40906237859)中 Linux 和 Windows 均通过；最新结果见 [Actions](https://github.com/HuSiyue-ai/file-workspace/actions)。

## 桌面端需要的能力

宿主需要支持本地插件、MCP App 界面资源、文件或聊天入口，以及将文件路径/聊天上下文转给正确的服务主机。文件双击打开、项目自动识别和加入聊天草稿等能力也依赖宿主。

远程场景中，电脑与服务器有各自的 Python、文件路径和 Codex 环境。服务器命令不能直接当成电脑本机命令运行；服务器安装记录也不能代替桌面端发现检查。

## 人工验收

按 [Linux / SSH 的桌面验收步骤](linux-ssh-installation.md#5-在电脑桌面端验收)，确认菜单可见、路径正确、正文/公式/嵌图显示，并通过临时文件验证保存。反馈时记录桌面、CLI、Python、插件版本与 SSH 上下文。

[功能图览](features.md)的截图来自隔离演示宿主，使用真实查看器和虚构数据；它们不表示每个平台都已完成桌面验收。
