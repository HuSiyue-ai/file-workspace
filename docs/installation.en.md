# Installation and maintenance

[Documentation](README.en.md) · [简体中文](installation.md) · [Linux / SSH](linux-ssh-installation.en.md) · [Troubleshooting](troubleshooting.en.md)

## Choose the runtime host

| Environment | Instructions |
| :--- | :--- |
| Codex, files, and Python on the same Windows computer | Continue below |
| Desktop on your computer, files on an SSH Linux server | [Linux / SSH](linux-ssh-installation.en.md) |
| macOS, cloud threads, other hosts | Check [compatibility](compatibility.en.md); currently unverified |

## Requirements

Use **Python 3.12+** and a CLI exposing `codex plugin marketplace add` and `codex plugin add`. The desktop host needs local plugins, MCP App file entrypoints, and file path metadata. CLI support alone does not establish desktop support.

Keep source and Python in a durable location. The generated configuration records both paths; rebuild and reinstall after moving source, removing the environment, or changing computers. Core Markdown/image use needs no third-party Python packages. Node.js is only for development checks; PDF is optional.

## Windows local

In PowerShell, confirm your Python version and create an isolated environment:

```powershell
python --version
git clone https://github.com/HuSiyue-ai/file-workspace.git
cd file-workspace
python -m venv .venv
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
```

Alternatively, extract a source archive into a durable directory and start with the venv command. Do not clone over an existing checkout.

Register the **repository root**, containing `.agents/plugins/marketplace.json`, then install:

```powershell
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

The display name is **file-workspace**; the CLI selector keeps its legacy internal identifier. Register the repository root, not `plugins/`.

Fully quit Codex, including its tray process, restart, and open your project. Open Markdown on the right and choose **file-workspace** from the file tab's Open menu. A new-tab plugin entrypoint may also be available, depending on the host version. [First session →](usage.en.md)

`doctor.py` only inspects; it does not install packages or change settings. `built: true` means build products exist, not that a desktop tab loaded successfully.

## Optional PDF preview

Install into the same environment:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-pdf.txt
.venv\Scripts\python.exe doctor.py
```

PDF uses a separate worker with `pypdfium2` and `Pillow`. An existing Codex PDF Python path takes precedence, otherwise the build interpreter is used. Inspect `pdfPython` and `pdfAvailable`. To override the interpreter, set an absolute `FILE_WORKSPACE_PDF_PYTHON` in the generated `.mcp.json` server environment and reinstall. The next build regenerates `.mcp.json`, so reapply that manual override after rebuilding.

For Linux commands, see [Linux / SSH](linux-ssh-installation.en.md#optional-pdf-and-development-checks). Pages are rendered as images; text selection, OCR, and PDF annotations are not supported.

## Update

Save documents, close plugin tabs, and record `git rev-parse HEAD` plus local configuration. Reuse the original Python environment:

```powershell
git pull --ff-only
.venv\Scripts\python.exe build.py
.venv\Scripts\python.exe doctor.py
codex plugin add markdown-math-preview@markdown-preview-local
```

On Linux, use `.venv/bin/python`. Builds reuse `.runtime/server-env.json` project, boundary, and headless settings. If local edits block the update, inspect the differences instead of forcing an overwrite.

Fully restart the desktop. Existing tabs keep their old HTML. Reinstalling updates the same plugin selector; avoid registering multiple copies of the same marketplace.

## Roll back

Keep the current source. Check out a known-good commit/tag in another durable location, rebuild, register that source, and reinstall. Check `codex plugin marketplace list` to confirm the marketplace resolves to the intended location. Do not discard edits with `git reset --hard`.

A plugin rollback does not restore documents. Original-file backups default to `~/.codex/backups/file-preview/`; see [backup configuration](linux-ssh-installation.en.md#access-boundary-and-backups).

## Uninstall

Save and close plugin tabs, then run:

```powershell
codex plugin remove markdown-math-preview@markdown-preview-local
codex plugin marketplace remove markdown-preview-local
```

These commands leave source, Python environments, and document backups in place. Review those separately and retain useful backups.

## How installation works

`build.py` combines bundled vendor assets into offline `viewer.html` and generates host-specific `.mcp.json`. Source distribution, local registration, and official directory listing are separate steps; this repository does not claim official directory approval. See the [official plugin packaging documentation](https://developers.openai.com/plugins/build/plugins).

## Default project in a new conversation

Existing conversation assignments and working directories take precedence. For an unsent local desktop conversation with no saved context, the empty launcher can read the desktop selected local project once. This is global compatibility state: simultaneous project changes in multiple windows may select the wrong initial root. Loaded or manually selected roots never follow later global changes. Startup retries delayed conversation context at most four times; refreshing an empty file tree retries the conversation lookup without reading global selection again.

Linux / SSH keeps the server conversation lookup or explicitly configured `--project-root` first. Desktop project selection is not automatically sent to the server. Update the server checkout, rebuild with its original Python environment and reinstall; preserve `.runtime/server-env.json`.
