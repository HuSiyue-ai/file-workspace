# Changelog

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
