# Changelog

## 1.15.2

- 现有对话按自身的项目关联打开文件树。尚未取得对话项目时，启动页提供已保存项目供选择，避免套用旧的全局项目。

## 1.15.1

- 本机文件树右键可用 Windows 默认应用打开 PDF、Office 文档及其他常见媒体和文档。

## 1.15.0

- 文件夹菜单支持固定本地和已配置的 SSH 文件夹，也可直接添加本机常用文件夹。
- 文件树新增前进和后退，在当前标签恢复浏览过的目录和文件。

## 1.14.2

- KaTeX 字体加载失败时，公式改用浏览器原生 MathML，保留不等号、范数、求和下标和分式层级。
- 窄栏内的宽公式可以横向滚动到完整内容。

## 1.14.1

- 刷新当前 Markdown 时保留阅读位置。若前面的内容增删，优先定位到仍在原处阅读的段落或附近可识别的内容。

## 1.14.0

- 「重载插件」可以切换兼容的文件服务后台，并保留已授权的文件夹、当前预览和文件树状态。
- 新后台通过验证后才接管请求。变更 Codex 连接配置、工具注册或启动入口时，需要重新建立插件连接。

## 1.13.2

- 兼容桌面端按账户保存的项目选中状态，恢复新项目未发送消息时的文件树。

## 1.13.1

- 文件树和预览遇到失效会话时，从当前项目或已配置 SSH 入口重新取得同一目录的凭证。重载会报告文件树恢复失败，项目菜单也可补取新对话稍后关联的目录。

## 1.13.0

- 文件树右键支持可恢复的单文件删除。本地文件进入 Windows 回收站，已配置备份目录的 SSH 工作区可以在文件树菜单恢复到原位置。

## 1.12.0 — 2026-11-10

- Create empty files from the tree context menu, with automatic preview for supported text formats.
- Reveal local files in Explorer and locate SSH files in the tree.
- Drop ordinary files into the current directory or a folder row, and export files through a local directory picker. Copies use bounded chunks and never overwrite existing entries.

## 1.11.1 — 2026-11-05

- Render Chinese/Japanese/Korean emphasis correctly when closing punctuation directly touches following text, without requiring added spaces or changing the document.
- Bundle the pinned, integrity-verified marked-cjk-friendly 0.1.3 emphasis tokenizer offline; keep code, math, sanitization and source-position editing intact.
- UI-only update: apply with “重载插件” in the existing tab.

## 1.11.0 — 2026-11-02

- Add an explicit same-tab “重载插件” button for compatible installed UI updates, preserving the current file, SSH session, tree branches, width, scroll position and staged comments.
- Verify the completed offline bundle and backend fingerprint before reloading; keep the current page and require an application restart for backend/configuration changes.
- Protect unsaved Markdown and active writes, reuse the existing host connection, and distinguish file/tree refresh from plugin reload. See [reload behavior](docs/reloading.md).

## 1.10.1 — 2026-10-31

- Route host-selected POSIX file links from local conversations through a matching configured SSH workspace before Windows filesystem validation.
- Keep remote images, manual saves and tree navigation on the returned session; do not infer routes for arbitrary arguments or replay writes.
- Automatically reveal linked files in the split tree, expand their ancestors and preserve editing focus, with stale/close/error guards.
- Match Linux directory names case-sensitively during path expansion. Native default-viewer selection remains a host setting per file type.

## 1.10.0 — 2026-10-31

- Add optional SSH workspaces to the existing project menu; connect lazily through an already configured OpenSSH alias.
- Reuse the remote backend for scoped directory browsing, Markdown editing and revision-checked saves with server-side backups, embedded images, PDF and other supported previews.
- Preserve the current view on failed switches, isolate host-specific drafts and references, and keep POSIX file names case-sensitive.
- Bound transport waits, reconnect only on subsequent user operations, and never automatically replay an uncertain save.
- Keep private machine-specific SSH profiles out of source control. See [SSH workspace setup](docs/ssh-workspaces.md).

## 1.9.0-linux.2 — 2026-10-31

- Populate a new conversation's launch tree from the desktop selected project when no saved conversation context exists. This fallback is read once per launcher, and never replaces a known conversation project or a manual selection.
- Retry late conversation context for a bounded startup period; file-tree refresh can retry without following another window's selected project.
- Cancel pending startup work when opening a file, choosing a folder or closing the viewer.
- Preserve Linux headless startup, configured project/allowed roots and CODEX_HOME when incorporating the Windows-local 1.8.3 fix.

## Documentation refresh — 2026-10-30

- Rebuild the Chinese/English homepages around platform selection, installation and first use.
- Preserve feature captures in a dedicated gallery; use a lightweight vector wordmark and one product preview on the homepage.
- Add bilingual documentation indexes, user guides, troubleshooting and compatibility pages.
- Refresh Linux preview release notes without replacing the original tag or verified downloads.
- Check documentation links/anchors/images in CI and add structured issue templates.

## 1.9.0-linux.1 — 2026-10-29 (Linux / SSH preview)

- Add persistent headless/project-root/allowed-root build options and honor CODEX_HOME for server project discovery.
- Constrain file, image, directory and save access to an optional configured root, including symlink escape checks.
- Disable native GUI pickers explicitly on headless hosts; retain the project file tree.
- Fix Windows-only paths in cross-platform tests and debugging harnesses.
- Add Linux/Windows CI and a source-only Linux preview release with SHA-256 checksums.
- Keep desktop SSH menu discovery and actual UI rendering explicitly pending manual verification.

## 1.8.2 — 2026-10-24

- Declare Pillow explicitly in the optional PDF dependencies; fresh environments need it for page-to-image conversion.
- Check Pillow as well as PDFium before reporting PDF readiness.
- Keep the desktop viewer behavior unchanged from 1.8.1.

## 1.8.1 — 2026-10-24

First repository distribution of the existing desktop prototype.

- Unified file tree for Markdown, images, PDF, source code and CSV/TSV.
- Locked reading, block-level Markdown editing and full-source editing.
- Version-checked manual saves, backups, draft recovery and undo/redo.
- Inline KaTeX math, offline Mermaid diagrams and local Markdown images.
- Inline diagram zoom, pan and reset without changing document height.
- Preserve unchanged preview nodes and anchor clicked text before layout changes.
- Excerpt comments, numbered bubbles and explicit add-to-chat-draft support.
- File-tree expansion, folder navigation, resize, context menu and new folders.
- Distribution cleanup: local build setup, third-party notices, test runner and examples.

Earlier 0.x–1.x versions were local development iterations and are not published here.
