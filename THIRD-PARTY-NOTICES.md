# Third-party notices

Project-owned code is MIT licensed. Bundled components retain their own licenses and copyright notices; the project MIT license does not replace them.

| Component | Bundled version | License / notice | Upstream |
| --- | --- | --- | --- |
| Marked | 16.4.2 | [original notice](vendor/marked.LICENSE.md), including MIT and retained additional notices | https://github.com/markedjs/marked |
| DOMPurify | 3.3.1 | [Apache-2.0 OR MPL-2.0](vendor/dompurify.LICENSE) | https://github.com/cure53/DOMPurify |
| KaTeX, CSS and fonts | 0.18.9 | [MIT](vendor/katex/LICENSE) | https://github.com/KaTeX/KaTeX |
| highlight.js + PowerShell/LaTeX | 11.12.0 | [BSD-3-Clause](vendor/highlight/LICENSE) | https://github.com/highlightjs/highlight.js |
| Mermaid | 11.15.0 | [MIT](vendor/mermaid/LICENSE) | https://github.com/mermaid-js/mermaid |

The offline build copies the corresponding license files into the generated plugin's `licenses/` directory. Preserve source headers and license files when redistributing.

`vendor/SHA256SUMS.json` records the exact checked-in assets. Original CDN integrity records are also retained for highlight.js and Mermaid; `python verify_vendor.py` checks the current bytes without accessing the network.

Optional PDF support uses separately installed pypdfium2/PDFium and Pillow for image encoding. Its upstream packages supply their own license notices; their binaries are not redistributed in this repository. The development-only pypdf package is used to create an encrypted test fixture.
