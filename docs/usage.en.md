# User guide

[Documentation](README.en.md) · [简体中文](usage.md) · [Feature gallery](features.en.md) · [Troubleshooting](troubleshooting.en.md)

## Open your first file

After installation and a full desktop restart, open Markdown on the right and select **file-workspace** from the file tab's Open menu. Continue through other documents, images, and data from the same workspace tree.

A host-provided new-tab plugin entrypoint may open a blank workspace. Automatic project discovery needs the current chat identifier and readable host state. For Linux/SSH, configure an [explicit project root](linux-ssh-installation.en.md#install-on-the-ssh-server) first.

## Tree and outline

| Action | Result |
| :--- | :--- |
| Click a file | Replace the preview in the current page |
| Click / double-click a folder | Expand or collapse / enter that folder |
| Up / locate button | Go to a permitted parent / locate the active file |
| Filter | Search loaded names rather than the whole disk |
| Drag the divider | Resize the tree |
| Outline | Navigate Markdown headings |
| Right-click a file | Copy its path, add a chat reference, or ask the host to open it |
| Right-click a folder | Create one child directory without replacing existing entries |

Directories load on demand, with at most 500 entries per listing. Double-clicking a file delegates to the host; the host determines tab reuse. See [access and format limits, 中文](limitations.md).

## Read, Edit, and Source

- **Read** keeps the document rendered for browsing, selection, and comments.
- **Edit** exposes the Markdown source of the paragraph, list, or code block you click; surrounding blocks stay rendered.
- **Source** edits the whole Markdown document, useful for structural changes.

Only existing UTF-8 `.md` / `.markdown` files are editable. Code, CSV/TSV, images, and PDFs have read-only previews.

## Save and handle conflicts

Click Save or press `Ctrl+S` to write changes. The original revision is checked with SHA-256, and its contents are backed up before replacement. If another program changed the file, the save is rejected.

Preserve a copy of your draft, refresh to read the latest file, then edit again. In-memory drafts are not durable backups. Resolve unsaved-change prompts when refreshing or switching files, and save before closing a tab.

For your first attempt, copy a [sample note](../examples/atlas-lab/notes/methods.md), edit it, save, refresh, and inspect the disk file. Use a disposable copy rather than your only document.

## Passage comments and chat drafts

1. Select a passage, choose Comment, and add a question or requested change.
2. Confirm it to leave a numbered bubble; collect more passages as needed.
3. Open the comments list to revise or remove entries.
4. Add them to the chat draft, review the content, and decide when to send.

Comments live only in the current tab's memory. Closing the tab clears them; they are neither written into Markdown nor permanent native host comments. Chat-draft support depends on the host.

## Explore other formats

| Content | Try this sample | Actions |
| :--- | :--- | :--- |
| Math | [equations.md](../examples/atlas-lab/notes/equations.md) | Inline math, matrices, fractions, display equations |
| Mermaid | [pipeline.md](../examples/atlas-lab/notes/pipeline.md) | Zoom controls, or Ctrl / ⌘ plus mouse wheel |
| Images | [Sample image](../examples/atlas-lab/figures/alpine-lake.webp) | Zoom, fit, original size; double-click to toggle |
| PDF | [Sample report](../examples/atlas-lab/reports/benchmark-report.pdf) | Pages, search, bookmarks; optional dependencies required |
| CSV | [benchmark.csv](../examples/atlas-lab/data/benchmark.csv) | Filter, page, toggle header and raw view |
| Code | [reconstruct.py](../examples/atlas-lab/src/reconstruct.py) | Read-only highlighting; use an external editor to modify |

The demo data is fictional, not research evidence. See [format limits, 中文](limitations.md) for network images, Office, media, and notebooks.
