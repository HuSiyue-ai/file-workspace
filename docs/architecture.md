# 架构与源码导航

[文档首页](README.md) · [贡献指南](../CONTRIBUTING.md) · [兼容性](compatibility.md)

```text
Codex file entry / launcher
          |
     local stdio MCP host (src/backend/backend_host.py)
          |
     replaceable file worker (src/backend/server.py)
          |
          +-- scoped file / image / directory readers
          +-- version-checked Markdown writer + backups
          +-- workspace sessions + native picker + project adapter
          +-- isolated PDF worker (optional pypdfium2)
          |
     offline viewer.html (build.py output)
          +-- Markdown + KaTeX + Mermaid + DOMPurify
          +-- block editor + history + source ranges
          +-- image / PDF / code / CSV surfaces
          +-- tree / outline / selection / excerpt comments
```

## Source layout

- 根目录保留构建、环境诊断、回归检查和本地演示入口。
- `src/backend/`：MCP 后端、目录与文件服务、SSH 及 PDF 工作进程。
- `src/viewer/`：侧栏界面、Markdown 解析、文件树与编辑器，由 `build.py` 构建。
- `tests/`：Python 和 JavaScript 的回归测试，由 `check.py` 运行。
- `scripts/`：维护脚本，包括 Linux 源码归档。
- `vendor/`：固定版本的第三方资源、原许可证、校验清单；运行不请求 CDN。
- `examples/`：可公开的虚构演示数据。
- `plugins/`：构建输出，包含机器相关配置，已忽略。
- `.agents/plugins/marketplace.json`：本地安装目录清单。
- `VERSION`：服务与插件清单共同使用的版本。
- `src/backend/access_policy.py`：可选目录边界检查。
- `.runtime/server-env.json`：本机项目、边界与 headless 配置；忽略发布。
- `verify_docs.py`：文档相对链接、锚点与配图引用检查。

前端通过 MCP Apps postMessage 与宿主通信。文件只在用户选择预览时读取；创建目录和保存文档使用明确的写工具。PDF 每次操作运行独立进程，避免 PDFium 线程问题。

Markdown 块始终对应原始 UTF-16 源文范围。编辑不从 HTML 反推源码；未变化的块复用已有 DOM，减少图片/图表重载。绘图输出清理后作为独立 SVG 图片显示。

图表、CSV 和代码内容均不执行；选区批注留在内存中，主动加入聊天草稿后交给宿主，不自动发送。
