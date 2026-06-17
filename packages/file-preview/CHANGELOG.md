# @lamberl-lee/file-preview

## 0.3.0

### Minor Changes

- 5581eb7: Excel preview v2: enhanced spreadsheet renderer, workbook theme colors, robust cell formatting.

  Highlights:

  - **Enhanced spreadsheet renderer**: Optional `x-data-spreadsheet` peer dependency adds an Excel-like canvas-based rendering path with smooth scrolling, cell selection, and sheet tabs. Automatically falls back to the HTML table renderer when the package is missing or initialization fails. Small fidelity-mode files default to the enhanced renderer; large/fast-mode files use the table fallback.
  - **Workbook theme color extraction**: Parses `xl/theme/theme1.xml` from the workbook ZIP to resolve the actual theme color scheme, replacing the hardcoded default Office palette. Cells using `theme` + `tint` (e.g., alternating row stripes, accent headers) now render with accurate colors instead of mis-resolved black/white blocks.
  - **Robust cell value formatting**: `formatCellValue` now safely handles all ExcelJS value shapes including `richText` inside `hyperlink.text`, nested objects, and edge cases that previously caused React error #31 ("Objects are not valid as a React child").
  - **White color preservation**: `resolveColor` and `styleToCss` no longer skip white (`#ffffff`) fills and font colors — they are meaningful in Excel styling (e.g., white text on dark headers, white fill overriding row stripes).
  - **Layered architecture**: `XlsxPreview.tsx` refactored from a 928-line monolith into `excel/` modules (`read-workbook`, `format-cell`, `convert-color`, `convert-style`, `media`, `theme`, `transform-table`, `transform-spreadsheet`, `spreadsheet-loader`, `types`) + `XlsxTablePreview` + `XlsxSpreadsheetPreview`.
  - **Renderer switch UI**: When both renderers are available, a lightweight "Enhanced / Table" toggle appears in the toolbar.
  - **i18n**: Added `enhancedRenderer`, `tableRenderer`, `enhancedRendererTitle`, `tableRendererTitle`, `enhancedRendererUnavailable` locale keys (zh-CN + en-US).
  - **New optional peer**: `x-data-spreadsheet ^1.1.9` (enhanced renderer only; table fallback requires only `exceljs`).

  Production-readiness pass for safer SDK integration:

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
