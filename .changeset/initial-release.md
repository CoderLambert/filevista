---
"@filevista/file-preview": minor
---

Initial public release of `@filevista/file-preview`.

A browser-side file preview toolkit for React supporting 20+ formats (PDF, DOCX, PPTX, XLSX, EPUB, RTF, Markdown, code, images, video, audio, ZIP, CSV, SVG, HTML, plain text) with zero server processing — files never leave the user's device.

Highlights:
- Plugin-based architecture with a lazy-loaded registry per file type
- Source abstraction over `File` / `Blob` / `ArrayBuffer` / URL
- Optional peer dependencies for the heavy formats (pdfjs-dist, exceljs, docx-preview, pptx-preview, rtf.js, jszip) — install only what you preview
- Framework-agnostic, zero-external-UI `fv-` prefixed CSS with theming via CSS variables
- Built-in zhCN/enUS locales with a `LocaleProvider` for custom localization
- Graceful fallback UI with install hints when an optional peer dep is missing

See the README for install, quick start, theming, and the optional peer dependency table.
