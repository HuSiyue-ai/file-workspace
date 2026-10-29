<div align="center">

<img src="docs/images/wordmark.svg" alt="file-workspace — Read. Edit. Explore." width="720">

<p><strong>Browse project files, edit Markdown, and bring passages into your Codex conversation.</strong></p>
<p>Math · Mermaid · Images · PDF · Code · CSV / TSV</p>

<p>
<a href="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml"><img src="https://github.com/HuSiyue-ai/file-workspace/actions/workflows/check.yml/badge.svg?branch=main" alt="Linux / Windows checks"></a>
<a href="https://github.com/HuSiyue-ai/file-workspace/releases/tag/v1.9.0-linux.1"><img src="https://img.shields.io/badge/Linux%20%2F%20SSH-preview-7561c7" alt="Linux / SSH preview"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16836a" alt="MIT License"></a>
</p>

<p><a href="README.md">简体中文</a> · <strong>English</strong></p>
<p><a href="#install">Install</a> · <a href="docs/features.en.md">Features & screenshots</a> · <a href="docs/usage.en.md">User guide</a> · <a href="docs/troubleshooting.en.md">Troubleshooting</a> · <a href="https://github.com/HuSiyue-ai/file-workspace/releases">Downloads</a></p>

</div>

<p align="center"><a href="docs/features.en.md"><img src="docs/images/showcase/retina/02-editor-2x.jpg" alt="Actual viewer: the active paragraph exposes Markdown source while the equation below remains rendered" width="720"></a></p>
<p align="center"><sub>Block editing in the actual viewer, captured in an isolated demo host. <a href="docs/visuals.md">Visual sources and verification scope</a>.</sub></p>

## One file tree. Keep reading, keep editing.

| Browse | Read | Edit & discuss |
| :--- | :--- | :--- |
| Expand folders on demand, switch files with a click, and navigate document outlines. | Typeset math, zoom diagrams and images, search PDFs, and filter tables. | Edit one block or the full source, save explicitly, and add passage comments to a chat draft. |

Read and edit existing UTF-8 `.md` / `.markdown` files. Code, tables, and PDFs have read-only previews. Comments stay in the current tab; adding them to chat prepares a draft and does not send it. [Explore all features →](docs/features.en.md)

## Install

Use **Python 3.12+** and a CLI with `codex plugin` commands. Core Markdown/image use needs neither Node.js nor third-party Python packages. Keep the source and Python environment in a durable location, and **build on the host that will run the plugin**.

| Your environment | Start here | Verification status |
| :--- | :--- | :--- |
| Windows + local Codex desktop | [Windows installation](docs/installation.en.md#windows-local) | Primary desktop validation environment; Windows CI passed. |
| Linux / SSH server + desktop on your computer | [Linux / SSH installation](docs/linux-ssh-installation.en.md) · [Preview download](https://github.com/HuSiyue-ai/file-workspace/releases/tag/v1.9.0-linux.1) | Server backend and Linux CI passed; desktop SSH discovery and actual rendering need manual verification. |
| macOS, cloud threads, other hosts | [Compatibility](docs/compatibility.en.md) | Not yet verified; check host capabilities first. |

<details>
<summary><strong>Windows quick start · PowerShell</strong></summary>

```powershell
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python -m venv .venv
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

`python --version` must be 3.12+. Fully quit Codex, including its tray process, then restart. Open a file on the right and select **file-workspace** from the file tab's Open menu. [Full instructions and optional PDF →](docs/installation.en.md)

</details>

<details>
<summary><strong>Linux / SSH quick start · Bash</strong></summary>

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

Replace the placeholders with existing server project directories. Run as the SSH login user; no `sudo` is needed. Fully restart the desktop, reconnect to the same SSH project, then choose **file-workspace** from the server file tab's Open menu. Verify server installation and desktop discovery separately. [Full instructions and acceptance checks →](docs/linux-ssh-installation.en.md)

</details>

The display name is **file-workspace**. Installation retains the internal selector `markdown-math-preview@markdown-preview-local`. This repository distributes source that needs a local build; its GitHub URL is not a ready-to-use remote service.

## Your first session

1. **Open a document**: open Markdown in the right panel, choose **file-workspace** from Open, then continue through the file tree.
2. **Try editing**: copy a [sample note](examples/atlas-lab/notes/methods.md), enter Edit or Source mode, change a sentence, save with `Ctrl+S`, and refresh to confirm.
3. **Explore formats**: use the [Atlas Lab demo](examples/atlas-lab/README.md) for math, diagrams, images, PDF, and tables. PDF needs [optional dependencies](docs/installation.en.md#optional-pdf-preview).

[User guide →](docs/usage.en.md) · [Missing plugin or images →](docs/troubleshooting.en.md)

## Files and saves

- **Local processing**: viewer assets ship with the plugin. It does not fetch network images or execute document code. Citations you explicitly add to chat are then handled by Codex.
- **Explicit saves**: revisions are checked and originals backed up before replacement. External changes block an overwrite. In-memory drafts and comments are not file backups.
- **Optional directory boundary**: `--allowed-root` constrains file, directory, embedded-image, and save access, rejecting paths that resolve outside it. These are application checks. Without it, the original same-drive policy remains broad on Linux.

[Supported formats and limits](docs/limitations.md) · [Platform and verification status](docs/compatibility.en.md)

## Documentation and feedback

| What you need | Entry points |
| :--- | :--- |
| Install, update, roll back, uninstall | [Installation](docs/installation.en.md) · [Linux / SSH](docs/linux-ssh-installation.en.md) |
| Learn features and everyday actions | [Feature gallery](docs/features.en.md) · [User guide](docs/usage.en.md) · [Demo project](examples/atlas-lab/README.md) |
| Diagnose issues or check support | [Troubleshooting](docs/troubleshooting.en.md) · [Compatibility](docs/compatibility.en.md) · [Format limits, 中文](docs/limitations.md) |
| Contribute or follow changes | [Contributing](CONTRIBUTING.md) · [Architecture, 中文](docs/architecture.md) · [Changelog](CHANGELOG.md) |

See the [documentation index](docs/README.en.md) for all guides. Report issues through [GitHub Issues](https://github.com/HuSiyue-ai/file-workspace/issues), with OS, desktop/CLI/plugin versions, steps, and a fictional minimal sample.

[MIT](LICENSE) © HuSiyue-ai · [Third-party notices](THIRD-PARTY-NOTICES.md) · [Visual sources](docs/visuals.md). Independent project; not affiliated with or endorsed by OpenAI.
