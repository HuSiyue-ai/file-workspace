# Troubleshooting

[Documentation](README.en.md) · [简体中文](troubleshooting.md) · [Installation](installation.en.md) · [Compatibility](compatibility.en.md)

## Installed, but no right-panel entry

On the host running the service, check:

```bash
codex plugin marketplace list
codex plugin list --marketplace markdown-preview-local --json
```

Confirm the expected source root and installed/enabled state. Save your work, close old tabs, fully quit the desktop including its tray process, restart, and open a new chat. Look for **file-workspace** in the file tab's Open menu.

For SSH, confirm the same host/user and a server-side file. If the entry is still missing, record the desktop version and menu screenshot. The host may not expose that entry to remote environments; repeated registration alone cannot establish support.

## Why does the installation name differ?

**file-workspace** is the display name. Installation/uninstall keeps the historical selector `markdown-math-preview@markdown-preview-local`. It is the same plugin.

## Python is too old, or the service path broke

Use Python 3.12+ in a dedicated user/project environment; do not replace system Python. Check the actual build interpreter and run `doctor.py` with it.

Moving source, removing its environment, or copying `.mcp.json` from another computer breaks its recorded paths. Rebuild on the target host, reinstall, and restart. Do not publish personal generated configurations.

## No graphical desktop for the folder picker

Build on the SSH server with `--project-root ... --allowed-root ... --headless`, using existing server directories. Reinstall and navigate through the project tree. `tkinterAvailable: true` means the module exists, not that a graphical session exists. See [Linux / SSH](linux-ssh-installation.en.md).

## Missing or unexpected project tree

Discovery depends on the current chat ID and state on the service host. Inspect `projectRoot`, `allowedRoot`, and `headless` in `doctor.py`. Configure an explicit fallback for SSH. A valid current-chat directory takes precedence over that fallback; a globally recent project is not the current-chat authority.

## Local images do not load

Confirm the image is embedded in the current Markdown, the path is relative to that document, and the file exists in a supported format. Unicode, spaces, reference images, and Obsidian syntax are supported, subject to size and access limits.

Network URLs, UNC shares, unreferenced images, and paths resolving outside the allowed root are rejected. Locally mounted paths are treated as local filesystem paths and remain subject to permissions/configuration. See [format limits, 中文](limitations.md).

## PDF is unavailable

Install `requirements-pdf.txt` into the actual PDF interpreter. Check `pdfPython` and `pdfAvailable` in `doctor.py`, rather than only your shell's `pip`. See [PDF setup](installation.en.md#optional-pdf-preview) for interpreter overrides.

PDF pages are images; text selection, OCR, forms, and PDF annotations are unavailable.

## Save rejected or changes missing

Only existing UTF-8 Markdown is editable. Typing does not save; use Save or `Ctrl+S`. On an external-modification warning, preserve your draft, refresh, and edit the latest version instead of overwriting outside changes.

Backups default to `~/.codex/backups/file-preview/`, unless `FILE_WORKSPACE_BACKUP_ROOT` selects another directory. In-memory comments and unsaved drafts are not permanent file backups.

## Still seeing the old version after updating

Rebuild the original marketplace source and run `codex plugin add markdown-math-preview@markdown-preview-local`. Old tabs keep their HTML: save, close them, fully restart the host, and reopen. Make sure the marketplace is not pointing to another old checkout.

## Report a problem

Use [GitHub Issues](https://github.com/HuSiyue-ai/file-workspace/issues). Include OS, local/SSH context, desktop/CLI/Python/plugin versions, steps, expected/actual results, and a fictional minimal file. Use cropped screenshots as needed; do not upload private documents, tokens, or complete environment dumps.
