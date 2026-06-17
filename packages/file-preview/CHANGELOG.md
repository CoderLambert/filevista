# @lamberl-lee/file-preview

## 0.3.0

### Minor Changes

- 5581eb7: Production-readiness pass for safer SDK integration.

  Highlights:

  - React 18 compatibility: `PluginPreviewRenderer` no longer uses React 19-only `use(promise)`; CI now runs the library tests under React 18.3.1.
  - Built-in large-file gate: `PluginPreviewRenderer` now protects previews by default (20 MB warn, 50 MB confirm, 100 MB block) with `largeFilePolicy="off"` for custom policies.
  - Remote URL safety: `processRemoteUrl` now has `maxBytes` (default 100 MB) and rejects oversize downloads via Content-Length preflight or mid-stream abort.
  - Local magic-byte detection: new `detectFileMeta(source)` plus shared `sniffMagic` / `sniffZipContainer` helpers detect PDF/images/ZIP Office containers/OLE before falling back to filename or MIME.
  - Standard error contract: new `PreviewError` / `PreviewErrorCode` and `PluginPreviewRenderer.onError` so consumers can switch on stable error codes instead of parsing messages.
  - Documentation: added `docs/supported-formats.md` to clarify supported formats, limitations, security posture, size limits, and optional peer dependencies.

## 0.2.0

### Minor Changes

- 0f5622d: Initial public release of `@lamberl-lee/file-preview`.

  A browser-side file preview toolkit for React supporting 20+ formats (PDF, DOCX, PPTX, XLSX, EPUB, RTF, Markdown, code, images, video, audio, ZIP, CSV, SVG, HTML, plain text) with zero server processing — files never leave the user's device.

  Highlights:

  - Plugin-based architecture with a lazy-loaded registry per file type
  - Source abstraction over `File` / `Blob` / `ArrayBuffer` / URL
  - Optional peer dependencies for the heavy formats (pdfjs-dist, exceljs, docx-preview, pptx-preview, rtf.js, jszip) — install only what you preview
  - Framework-agnostic, zero-external-UI `fv-` prefixed CSS with theming via CSS variables
  - Built-in zhCN/enUS locales with a `LocaleProvider` for custom localization
  - Graceful fallback UI with install hints when an optional peer dep is missing

  See the README for install, quick start, theming, and the optional peer dependency table.
