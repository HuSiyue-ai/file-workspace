# Architecture

```text
Codex file entry / launcher
          |
     local stdio MCP server (server.py)
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

- 根目录 Python：后端、构建、测试和本地调试入口。
- 根目录 JavaScript：按界面职责分块，由 `build.py` 拼接；不需要 npm 构建。
- `markdown-parser.mjs`：项目自己的 Marked/KaTeX 适配与源码区间生成。
- `vendor/`：固定版本的第三方资源、原许可证、校验清单；运行不请求 CDN。
- `examples/`：可公开的虚构演示数据。
- `plugins/`：构建输出，包含机器相关配置，已忽略。
- `.agents/plugins/marketplace.json`：本地安装目录清单。

前端通过 MCP Apps postMessage 与宿主通信。文件只在用户选择预览时读取；创建目录和保存文档使用明确的写工具。PDF 每次操作运行独立进程，避免 PDFium 线程问题。

Markdown 块始终对应原始 UTF-16 源文范围。编辑不从 HTML 反推源码；未变化的块复用已有 DOM，减少图片/图表重载。绘图输出清理后作为独立 SVG 图片显示。

图表、CSV 和代码内容均不执行；选区批注留在内存中，主动加入聊天草稿后交给宿主，不自动发送。
