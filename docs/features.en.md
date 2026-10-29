# Features and interface

[Documentation](README.en.md) · [简体中文](features.md) · [Start using it](usage.en.md)

These captures show the real viewer in an isolated demonstration host using the fictional Atlas Lab project. They do not establish desktop SSH compatibility. [Visual sources](visuals.md).

## Browse your project

### File tree: switch files without losing context

Notes, data, figures, and reports sit together in the project tree. Single-click a file to replace the **current preview**, preserving expanded folders, tree width, and position within the page session.

<p align="center"><a href="images/showcase/retina/01-tree-2x.jpg"><img src="images/showcase/frames/01-tree.svg" alt="File tree: expanded notes and distinct file icons at two-times display resolution" width="340"></a></p>

- **Click a folder** to expand or collapse it; **double-click** to enter. Use `↑` to go up, or the locate button to find the active file.
- Switch roots through the project menu. Filtering searches loaded names rather than scanning your whole drive.
- Drag the divider to resize the tree; collapse it to restore the document's full width. Both areas scroll independently.
- Right-click to copy a path, add a file to chat, or open it through the host. Create subfolders from a folder's menu. Double-clicking a file also hands it to the host.

### Outline: navigate the structure of a document

The tree shows where your material lives; the outline shows where you are inside it. Open **Outline** to browse headings by level and jump straight to a section.

<p align="center"><a href="images/showcase/retina/10-outline-2x.jpg"><img src="images/showcase/frames/10-outline.svg" alt="Document outline: expanded heading hierarchy and current reading location" width="340"></a></p>

- Expand individual sections or expand / collapse the entire heading hierarchy.
- The active section follows your reading position as the document scrolls.
- The outline shares the resizable sidebar with the file tree; switch or hide it whenever needed.

## Edit and discuss

### Block editing: reveal only the source you need

**Read** mode locks the document for browsing and selection. Switch to **Edit**, then click a paragraph, list, or code block. Only that block reveals its Markdown; surrounding headings, equations, and images stay rendered.

<p align="center"><a href="images/showcase/retina/02-editor-2x.jpg"><img src="images/showcase/frames/02-editor.svg" alt="Block editing: bold and inline-math source in one passage, with rendered display math below" width="600"></a></p>

1. Select **Edit** and click a block. For ordinary text and code, the editor attempts to place the caret at the clicked position.
2. Change the text, then click another block. The previous one renders again and the next reveals its source.
3. Use **Source** mode for whole-document changes. Undo and redo are supported.
4. Click **Save** or press `Ctrl+S` to write to disk. An external-change conflict prevents an overwrite; the original file is backed up before saving.

The screenshot shows `**预测位置**` and `$e$` as source while the display equation stays rendered. Editing supports existing UTF-8 `.md` / `.markdown` documents.

### Selection comments: keep a question with its passage

Keep the quotation and your own thought separate, collect several passages, then add them to the conversation together. Confirmed comments appear as numbered bubbles you can revisit.

<p align="center"><a href="images/showcase/retina/05-comments-2x.jpg"><img src="images/showcase/frames/05-comments.svg" alt="Comment close-up: a numbered bubble on the first passage and a compact input beside the next" width="600"></a></p>

1. Select text, click **Comment…**, and enter a question or requested change in the compact input.
2. Confirm with `✓` to keep a numbered bubble, then continue selecting passages.
3. Open **Comments N** in the toolbar to edit individual comments or remove quotations.
4. Choose **Add to chat draft** to include each quote with its comment. **Nothing is sent automatically.**

Comments live in the current tab's memory and disappear when it closes. They are not permanent Markdown annotations or native host comment cards.

## Read each format

### Math: keep the derivation in the document

Inline equations flow with the sentence; display equations get their own space. Matrices, fractions, integrals, and scripts are rendered locally with KaTeX.

<p align="center"><a href="images/showcase/retina/03-math-2x.jpg"><img src="images/showcase/frames/03-math.svg" alt="Math close-up: inline notation, a transition matrix, and an underbrace" width="600"></a></p>

- Use `$...$` for inline math and `$$...$$` for display math.
- Mix equations into paragraphs, lists, blockquotes, and tables.
- Edit the original Markdown / LaTeX source; rendered output does not replace the document text.

Try the [equation notes](../examples/atlas-lab/notes/equations.md).

### Diagrams: inline, readable, and zoomable

Mermaid code blocks become diagrams inside the document. Inspect the workflow, then keep reading the explanation immediately below it.

<p align="center"><a href="images/showcase/retina/04-mermaid-vector.svg"><img src="images/showcase/frames/04-mermaid.svg" alt="Mermaid close-up: the native SVG output of a colored branching workflow" width="600"></a></p>

- Hover or focus the diagram to reveal `−`, `+`, and reset controls.
- Use `Ctrl` / `⌘` + wheel to zoom, then drag to pan.
- Zoom retains the diagram's allocated height rather than pushing the following text down.
- Read mode shows the diagram; edit and source modes retain its definition. A parsing error leaves the source available for inspection.

Try the [data pipeline](../examples/atlas-lab/notes/pipeline.md).

### Images: from the full frame to the details

Open images in the same workspace. Fit the complete image, then zoom in to inspect a screenshot, figure, or photograph.

<p align="center"><a href="images/showcase/retina/06-images-2x.jpg"><img src="images/showcase/frames/06-images.svg" alt="Image viewer: a complete alpine scene with zoom, fit-to-window, and actual-size controls" width="600"></a></p>

- Wheel zoom is centered on the pointer; drag after zooming in. The toolbar offers `−`, `+`, fit-to-window, and actual size.
- Double-click to switch fit / actual size. Focus the image area to use keyboard zoom and pan shortcuts.
- Pixel dimensions and format are shown. PNG, JPEG, GIF, WebP, SVG, BMP, ICO, and AVIF decoding depends on the host.
- Markdown embeds support local relative paths, spaces and Chinese characters in paths, reference images, and Obsidian image syntax.

The [alpine sample](../examples/atlas-lab/figures/alpine-lake.webp) is AI-generated artwork used to demonstrate the viewer.

### PDF: search the report, jump to a bookmark

Click a PDF in the tree and keep reading on the same page. Navigate by page number, zoom level, bookmark, or a cross-page text search.

<p align="center"><a href="images/showcase/retina/07-pdf-2x.jpg"><img src="images/showcase/frames/07-pdf.svg" alt="PDF reader: a fictional report, highlighted runtime matches, and cross-page search results" width="600"></a></p>

- Move between pages or enter a page number; select fit-to-width or a fixed zoom level.
- Search for a word, choose a matching page, and see its occurrences highlighted.
- Open **Outline** to navigate the document's own bookmarks.
- Rendering runs in a separate PDF process, with optional `pypdfium2` and `Pillow` dependencies.

Try the [fictional benchmark report](../examples/atlas-lab/reports/benchmark-report.pdf). Pages are displayed as images; PDF text selection, OCR, forms, and annotations are not supported.

### CSV / TSV: filter first, then read

Inspect experiment logs and exported data without first opening a spreadsheet app. The viewer provides columns, filtering, pagination, and a raw-text view.

<p align="center"><a href="images/showcase/retina/08-csv-2x.jpg"><img src="images/showcase/frames/08-csv.svg" alt="CSV viewer: filtering 48 fictional records down to four review items, preserving headers and row numbers" width="600"></a></p>

- Filter the loaded table by a keyword while retaining original row numbers for reference.
- Toggle whether the first row is a header, and page through longer tables.
- Switch between **Table** and **Raw text** to inspect delimiters and original content.
- This is a read-only viewer: it does not edit cells or evaluate formulas. Size and row / column limits are reported rather than silently ignored.

Try the [48-record CSV](../examples/atlas-lab/data/benchmark.csv). All data is fictional.

### Code: highlighted and read-only

Jump from a document into its implementation. Syntax highlighting distinguishes functions, strings, comments, and keywords.

<p align="center"><a href="images/showcase/retina/09-code-2x.jpg"><img src="images/showcase/frames/09-code.svg" alt="Code close-up: a Python data class, type annotations, and a Chinese docstring" width="560"></a></p>

- Language detection follows the file type; ordinary UTF-8 text is also readable.
- Highlighting assets ship with the plugin, without runtime CDN requests.
- Source is read, not executed. Use an external editor to change code files.
- Notebooks currently show raw JSON; Office files, audio, video, and other unsupported formats are handed to the host.

Try the [Python sample](../examples/atlas-lab/src/reconstruct.py).
