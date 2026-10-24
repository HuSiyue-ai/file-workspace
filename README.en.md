<div align="center">

<img src="docs/images/logo.svg" width="76" height="76" alt="file-workspace logo">

<h1>file-workspace</h1>

<p><strong>Your files, at home in the Codex sidebar.</strong></p>
<p>Browse projects · Read documents · Edit in place · Discuss selections</p>

<p>
  <a href="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml"><img src="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml/badge.svg?branch=main" alt="Checks"></a>
  <a href="https://github.com/HuSiyue-ai/file-workspace/tags"><img src="https://img.shields.io/github/v/tag/HuSiyue-ai/file-workspace?label=version&amp;color=2563eb" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb" alt="MIT License"></a>
  <a href="docs/installation.md"><img src="https://img.shields.io/badge/tested_on-Windows-64748b" alt="Tested on Windows"></a>
</p>

<p><a href="README.md">简体中文</a> · <strong>English</strong></p>

<p>
  <a href="#highlights">Highlights</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#supported-files">Supported files</a> ·
  <a href="docs/installation.md">Installation guide</a> ·
  <a href="https://github.com/HuSiyue-ai/file-workspace/issues">Report an issue</a>
</p>

</div>

![file-workspace: Markdown, math, an inline diagram, and a shared file tree](docs/images/workspace-preview.png)

**file-workspace** is a local file plugin for the Codex desktop sidebar. Browse Markdown, images, PDFs, code, and tables through one shared file tree. Edit a passage where you read it, or bring a selection and your comment into the current conversation.

## Highlights

### One file tree, a continuous reading flow

Single-click a file to preview it in the current page, with your project tree still beside it.

- **Familiar navigation.** Click a folder to expand or collapse it; double-click to enter. Go up a level, locate the current file, or switch project roots.
- **Room to read.** The tree sits beside the document. Drag the divider to resize it, or collapse it to restore the full preview width.
- **Everyday file actions.** Filter loaded entries, copy paths, create folders, and add files to chat. Double-click a file to hand it to Codex.

### Keep the preview. Edit just the block you need.

Switch to **Edit** and click a block to reveal its Markdown source. Leave the block to render it again; the rest of the document stays formatted. A full-source mode is also available for larger changes.

![Block editing: source for the active passage, rendered content everywhere else](docs/images/block-editing.png)

**You choose when changes reach disk.** Click **Save** or press `Ctrl+S`. Before writing, the plugin checks for external changes and backs up the original file.

### Math, diagrams, and images belong in the document

- **Math.** Inline and display equations rendered with KaTeX, including mixed text in lists and blockquotes.
- **Diagrams.** Mermaid renders inline. Hover for zoom controls, use `Ctrl` / `⌘` + wheel to zoom, and drag after zooming in.
- **Local images.** Relative paths, paths with spaces or Chinese characters, reference images, and Obsidian embeds. Standalone images support zoom, pan, fit-to-window, and actual size.
- **Selection comments.** Select text, add a comment, revisit it through a numbered bubble, and add the quote and comment to a chat draft. Sending remains your choice.

## Quick start

**Requirements:** Python **3.12+**, a **Codex desktop** version with local plugins and MCP App file entries, and a CLI supporting `codex plugin`. Windows is the primary tested environment. Native file dialogs require Tkinter.

### 1. Clone and build

Choose a directory you intend to keep, then run in PowerShell:

```powershell
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python build.py
python doctor.py
```

### 2. Register and install

Continue from the repository root:

```powershell
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

`markdown-math-preview` is the legacy internal identifier, retained for compatibility. The display name is **file-workspace**. A local build is required; the GitHub URL alone is not a ready-to-install remote plugin source.

### 3. Open your first file

1. Fully quit Codex, including its tray process, then restart it.
2. Open a Markdown file or image in the sidebar. From its **Open** menu, choose the in-app **file-workspace** viewer.
3. Open the file tree and click another file to switch the preview in place.

You can also enter a blank workspace through the plugin tool entry on a new tab, then select a project folder. Entry placement depends on the host version. Try [the demo document](examples/demo.md) for math, Mermaid, and a local image.

> Missing an entry, updating, or rolling back? See the [installation guide](docs/installation.md). `python doctor.py` only checks your environment; it does not install software or change settings.

<details>
<summary><strong>Want PDF previews? Install the optional dependencies.</strong></summary>

```powershell
python -m pip install -r requirements-pdf.txt
```

PDF support uses `pypdfium2` and `Pillow`. The plugin prefers an available Codex PDF runtime, then the Python interpreter used to build it. Set `FILE_WORKSPACE_PDF_PYTHON` to override this choice. Run `python doctor.py` to check the selected environment.

</details>

## Supported files

| File | Available in the workspace |
| :--- | :--- |
| **Markdown** · `.md` / `.markdown` | Reading, block and full-source editing, outline navigation, math, Mermaid, local images |
| **Images** · PNG / JPEG / GIF / WebP / SVG / BMP / ICO / AVIF | Zoom, pan, fit-to-window, actual size; decoding depends on the host |
| **PDF** · optional dependencies | Pages, zoom, bookmarks, text search |
| **Code and text** | Offline syntax highlighting and raw text |
| **CSV / TSV** | Pagination, filtering, header toggle, raw text |
| **Other files** | Browse in the tree and hand off to the host |

Markdown editing supports existing UTF-8 documents. PDF text selection, OCR, forms, and annotations are not supported. There are no dedicated Office, audio/video, or Notebook renderers. See [support and limits](docs/limitations.md) for format and size boundaries.

## Local rendering. Explicit saves.

Rendering libraries ship with the plugin; no runtime CDN requests are needed. The plugin does not upload files, fetch remote images, or execute document code. Quotes you explicitly add to a conversation enter its draft and are then handled by Codex.

- **Manual saves.** External changes are checked before writing; a conflict prevents an overwrite.
- **Original-file backups.** Stored in `~/.codex/backups/file-preview/` for recovery.
- **Temporary comments.** Bubbles and comments live in the current tab's memory. Add them to a draft before closing the tab.

The selected file or project establishes an access anchor. Subsequent browsing can reach files on the **same drive**; this is not a project-directory sandbox. Read the [access boundaries and compatibility notes](docs/limitations.md).

## FAQ

<details>
<summary><strong>Does this replace the native Codex file viewer?</strong></summary>

It is an in-app plugin with its own tree, editor, and comment UI, entered through a file's **Open** menu. The host tab usually displays the plugin name; the active file name appears in the plugin toolbar. The host decides whether a native open action creates or reuses a tab.

</details>

<details>
<summary><strong>What if the project root is not detected?</strong></summary>

Automatic detection relies on host metadata and a local state adapter, which may need updates when the host changes. Select a folder manually from the project menu to continue browsing.

</details>

<details>
<summary><strong>Which systems are tested? Do I need Node.js?</strong></summary>

Windows is the primary tested environment. Other operating systems and every Codex desktop version are not guaranteed to work. Node.js is needed for development checks, not normal use. Keep the source directory and Python interpreter available; rebuild and reinstall after moving them.

</details>

## Documentation and contributing

The detailed guides below are currently in Chinese. This README covers installation and everyday use in English.

| I want to… | Start here |
| :--- | :--- |
| Install, update, roll back, or uninstall | [Installation](docs/installation.md) |
| Check format limits and known boundaries | [Support and limitations](docs/limitations.md) |
| Understand the server, renderer, and editor | [Architecture](docs/architecture.md) |
| Report a problem or contribute | [Contributing](CONTRIBUTING.md) · [Issues](https://github.com/HuSiyue-ai/file-workspace/issues) |
| Read version changes | [Changelog](CHANGELOG.md) |

<details>
<summary><strong>Local development and checks</strong></summary>

Requires Python 3.12+ and Node.js. From the repository root:

```powershell
python -m pip install -r requirements-dev.txt
python build.py
python check.py --require-pdf
```

Checks cover file access, paths, save conflicts, directories, the MCP handshake, frontend state regressions, Markdown parsing, PDF support, and vendor integrity. Without PDF dependencies, run `python check.py` to check the other features.

`python dev_preview.py` starts an isolated UI bound only to `127.0.0.1`. Chat-draft requests are intercepted and do not reach a real conversation. This harness does not replace testing in Codex desktop.

</details>

## License and acknowledgements

[MIT License](LICENSE) © HuSiyue-ai. Third-party components retain their own licenses; see [third-party notices](THIRD-PARTY-NOTICES.md).

Built with [Marked](https://github.com/markedjs/marked), [KaTeX](https://github.com/KaTeX/KaTeX), [Mermaid](https://github.com/mermaid-js/mermaid), [DOMPurify](https://github.com/cure53/DOMPurify), [highlight.js](https://github.com/highlightjs/highlight.js), and [pypdfium2](https://github.com/pypdfium2-team/pypdfium2).

Designed and maintained by **HuSiyue-ai** around everyday use, with AI-assisted development. An evolving independent project; not affiliated with or endorsed by OpenAI.
