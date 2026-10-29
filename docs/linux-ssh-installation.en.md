# Linux / SSH installation

[Documentation](README.en.md) · [简体中文](linux-ssh-installation.md) · [Compatibility](compatibility.en.md) · [Troubleshooting](troubleshooting.en.md)

`v1.9.0-linux.1` adds a headless server configuration to file-workspace. It is a **preview release**: Linux backend tests pass, while the Codex desktop SSH menu and actual side-panel rendering still require verification on the user's desktop version.

## Requirements

- Linux and Python **3.12+**. Core Markdown/image use needs only the Python standard library; Node.js is only required for development checks.
- A Codex CLI exposing `codex plugin marketplace add` and `codex plugin add` (tested: 0.162.1).
- A desktop host capable of discovering plugins on the SSH host and forwarding MCP App file/thread entrypoints. Installing on a server alone does not establish this capability.
- A stable checkout location and Python interpreter belonging to the SSH login user. Do not run registration with `sudo`.

## Install on the SSH server

Download and extract the Linux **source** archive from the release, or clone the repository and check out the release tag. The source archive includes vendor assets and licenses, but deliberately excludes Python runtimes and machine-specific build products.

For release downloads, place the source archive and `SHA256SUMS.txt` together and verify before extracting into a new directory:

```bash
sha256sum -c SHA256SUMS.txt
tar -xzf file-workspace-1.9.0-linux.1-linux-source.tar.gz
cd file-workspace-1.9.0-linux.1
```

The checksum should report `OK`. Git users may instead clone the repository into a new durable directory.

Use a Python 3.12+ interpreter available to your account. If the system default is older, install a separate user/project interpreter first; do not replace the system Python.

From the extracted repository, create a project environment and build:

```bash
python3.12 -m venv .venv
.venv/bin/python build.py \
  --project-root /absolute/path/to/your/project \
  --allowed-root /absolute/path/to/your/project \
  --headless
.venv/bin/python doctor.py
codex plugin marketplace add .
codex plugin add markdown-math-preview@markdown-preview-local
```

Replace both example paths with existing server directories. The project root must be inside the allowed root. Use a parent as `--allowed-root` only if you intend to browse its other projects. The native GUI picker is disabled in headless mode; navigate using the project file tree instead.

`build.py` persists these settings in ignored `.runtime/server-env.json`; later builds without flags reuse them. It generates `.mcp.json` with this server's Python and source paths. Rebuild and reinstall after moving the source or replacing its Python environment. Never reuse Windows build products.

The current host-supplied chat ID takes precedence when its server state resolves to a permitted project. `--project-root` is the explicit fallback when host metadata/state is unavailable. The process working directory is not used as an implicit fallback. `CODEX_HOME` is honored for state discovery.

## Access boundary and backups

`--allowed-root` adds an application-level boundary for document reads/saves, directory navigation/creation, and embedded local images. Parent traversal and symlinks resolving outside that directory are rejected; directory listings skip symlinks. This is not OS-level sandboxing or protection against concurrent filesystem changes. Without `--allowed-root`, the original same-drive policy remains, which is broad on Linux.

Manual saves still compare SHA-256 revisions and back up the original before replacing it. Backups default to the login user's `~/.codex/backups/file-preview/`. Advanced server configuration may set `FILE_WORKSPACE_BACKUP_ROOT` to a durable private directory. Keep backups; they are not disposable build caches.

## Desktop acceptance check

1. Save existing work, close old plugin tabs, fully quit the desktop app including its tray process, and restart.
2. Reconnect to the same SSH host/user and project. Open a new chat to refresh plugin discovery.
3. Open `examples/welcome.md` on the server in the right panel. In the file tab's **Open** menu, select **file-workspace**. If the desktop offers a new-tab plugin tool entrypoint, that can also open the project tree.
4. Confirm server paths, UTF-8 Markdown, formulas, and local referenced images appear. Use the file tree rather than a server-side native file dialog.
5. Copy a sample into a temporary document in your project. Change a sentence in Edit/Source mode, save with `Ctrl+S`, refresh, and verify the change on the server.

If file-workspace does not appear in the menu, record the desktop version and SSH context. The server registration, desktop plugin discovery, and actual UI rendering are separate checks. Do not register server Python paths as commands to run on the local computer.

## Optional PDF and development checks

The first Linux installation was tested on Ubuntu 22.04 x86_64, Python 3.12.14, and Codex CLI 0.162.1: real stdio startup, offline UI resource, current-thread project discovery, explicit fallback, local SVG/PNG reads with Unicode/spaces, test-document save/backup/readback, stale-revision rejection, and out-of-boundary rejection passed. That installation did not verify PDF or the actual desktop UI.

For optional PDF preview, install `requirements-pdf.txt` into the same environment. Use `doctor.py` to confirm `pdfPython` and `pdfAvailable`. For complete repository regressions, including optional PDF processing:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
FILE_WORKSPACE_PDF_PYTHON="$PWD/.venv/bin/python" .venv/bin/python check.py --require-pdf
```

GitHub Actions runs these checks on Linux and Windows before publishing this preview. Read the linked workflow result for the actual CI outcome. A CI pass still does not prove desktop SSH integration.

See [installation and rollback](installation.en.md) for updating and uninstalling. Keep the checkout and its environment while the plugin is installed; the generated MCP command references them directly.
