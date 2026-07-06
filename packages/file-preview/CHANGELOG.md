# @lamberl-lee/file-preview

## 0.6.0

### Minor Changes

- 5c48b0b: `createRemoteFileInfo()` — build a `FileInfo` for a remote URL using metadata the caller already has (e.g. a backend file listing that returns `name` + `size` without downloading the body).

  ### Added

  - **`createRemoteFileInfo({ name, size, url, mimeType?, headers?, id? })`**: new public helper in `remote-url.ts`. Unlike `processRemoteUrl()`, this does NOT fetch — the size is taken from caller-supplied metadata, so `LargeFileGate` can apply warning / confirm / block thresholds before any network traffic starts. The download happens lazily, when a preview plugin calls `readSourceAsArrayBuffer(source)` / `readSourceAsText(source)`.

  ### Trade-offs vs `processRemoteUrl()`

  | Capability            | `processRemoteUrl()`                   | `createRemoteFileInfo()`                              |
  | --------------------- | -------------------------------------- | ----------------------------------------------------- |
  | Size detection timing | After download                         | At metadata arrival                                   |
  | Network requests      | Eagerly fetches the body               | Lazy — only when the plugin renders                   |
  | MIME sniffing         | magic bytes + extension + Content-Type | Extension only (or caller-supplied `mimeType`)        |
  | 100 MB hard cap       | Built-in (`DEFAULT_REMOTE_MAX_BYTES`)  | None — caller controls via `largeFilePolicy.maxBytes` |
  | Download progress     | `onProgress` callback                  | None                                                  |
  | Error normalization   | Typed `RemoteUrlError` with `code`     | Plain `Error` from `readSourceAsArrayBuffer`          |

  ### Use case

  Backend file listings that already return `size` (e.g. `{ "name": "report.pptx", "size": 10152828, "last_modified": 1782957982 }`). Wire the metadata straight into the preview gate so oversized files are blocked at click time, before any bytes are transferred.

## 0.5.1

### Patch Changes

- 9bbc855: HTML preview fixes: blob URL leak, ExcelJS ESM/CJS interop, security toggle.

  ### Fixed

  - **HtmlPreview blob URL leak**: when `content` changed, the previous `useMemo` + `useEffect([blobUrl])` pattern caused React StrictMode to revoke URLs that were still mounted, producing iframe flashes. Replaced with `useState` + `useEffect([content])` so cleanup runs exactly once per content change.
  - **ExcelJS ESM interop**: under bundler configs that wrap the CJS module as `{ default: Module }`, `EJS.Workbook` was `undefined` and XLSX preview crashed on load. Now resolves `mod.default?.Workbook ?? EJS.Workbook` with a typed cast covering both shapes.

  ### Added

  - **HTML security toggle**: `HtmlPreview` now exposes a `safe` ↔ `trusted` switch in the view-mode bar. Default stays `safe` (no scripts, no forms, unique origin) — running untrusted HTML with scripts is a known XSS vector. Users can opt in to `trusted` (sandbox: `allow-scripts allow-same-origin allow-popups allow-forms`) for files they trust, with a warning banner explaining the risk. Three new i18n strings: `htmlEnableScripts`, `htmlDisableScripts`, `htmlTrustedModeHint` (zh-CN and en-US).

## 0.5.0

### Minor Changes

- 0773651: Configurable large file policy + detached-ArrayBuffer crash fix.

  ### Added

  - `largeFilePolicy` prop on `PluginPreviewRenderer` accepts `"default"` | `"off"` | `PreviewSizePolicyConfig`, letting callers customize warning / confirm / block thresholds (or disable the gate entirely).
  - `validatePreviewSizePolicy` / `resolvePreviewSizePolicy` helpers exported from the package entry point for runtime validation of caller-supplied policy values.
  - `LargeFileGate` accepts `onError` (receives `PreviewError("FILE_TOO_LARGE")` with `actualBytes` / `maxBytes` / `fileType` details) and `renderBlockedFallback` (custom block UI).
  - `downloadSource` now branches by source kind: `file` / `blob` skip the ArrayBuffer round-trip; `url` without headers uses `<a download>` directly; `url` with headers goes through `fetch` and lets caller-supplied `mimeType` override the response `Content-Type`. Network / HTTP errors are normalized to `PreviewError` (`REMOTE_CORS_ERROR` / `REMOTE_HTTP_ERROR`).
  - Five new i18n strings (`fileTooLargeToPreview`, `fileTooLargeBlockedDesc`, `largeFilePreviewTitle`, `previewAnyway`, `largeFileWarningBanner`) with `{actualSize}` / `{maxSize}` / `{fileSize}` placeholders, in zh-CN and en-US.

  ### Fixed

  - `readSourceAsArrayBuffer` no longer returns `source.buffer` directly for `arrayBuffer` sources. Downstream consumers (pdf.js `getDocument({ data })`) transfer the buffer to a Web Worker, which detached the original and crashed subsequent reads with `Cannot perform Construct on a detached ArrayBuffer`. The function now returns `source.buffer.slice(0)`, matching the fresh-buffer-per-call behavior of the `file` and `blob` branches.
  - `LargeFileGate` block-report dedup keyed on `file.name + file.size + file.fileType` missed re-reports when the same name/size pair was re-selected. Now keyed on `file.id + file.size + file.name` so contract-violating id reuse still re-reports.
  - `validatePreviewSizePolicy` now rejects `Infinity` / `NaN` for `warningBytes` and `confirmBytes` (previously only checked `<= 0`), which would have silently disabled the warning tier at runtime.

## 0.4.0

### Minor Changes

Subpath exports, safer PPTX fallback, and consumer-callback isolation.

#### Breaking

- **Root entry no longer exports heavy plugins.** `import { pdfPlugin, pptxPlugin, docxPlugin, xlsxPlugin, rtfPlugin, zipPlugin, epubPlugin, builtinPreviewPlugins, createBuiltinPreviewRegistry } from "@lamberl-lee/file-preview"` no longer resolves. The root entry is now a clean base-only entry whose module graph never touches optional peer dependencies. Migrate:
  - Full registry: `import { createFullPreviewRegistry } from "@lamberl-lee/file-preview/full"`
  - Individual heavy plugins: `import { pptxPlugin } from "@lamberl-lee/file-preview/plugins/pptx"` (and `pdf`, `docx`, `xlsx`, `rtf`, `zip`, `epub`)
- **`<PluginPreviewRenderer>` defaults to the base registry.** Heavy formats (PDF/DOCX/PPTX/XLSX/RTF/ZIP/EPUB) are reported as `UNSUPPORTED_FILE_TYPE` unless you pass `registry={createFullPreviewRegistry()}`. This is the visible side of the root-entry cleanup above.

#### PPTX fallback (degraded view) hardening

- **No more cross-file state bleed.** `semanticDeck` and `insight` are now reset at the _start_ of each source mount, not only on successful viewer open. Previously a failed file B could surface file A's fallback content.
- **`isModeSwitching` is reset on source change.** Switching sources while a mode switch was in flight no longer leaves mode buttons / keyboard nav permanently disabled.
- **Per-slide and total XML limits are now enforced**, not just warned. `readPptxInsight` and `readPptxSemanticDeck` `break` once the cumulative XML code-unit ceiling is reached. Constants renamed to `maxXmlCodeUnitsPerSlide` / `maxTotalXmlCodeUnits` to reflect that they count UTF-16 code units, not bytes.
- **Insight is skipped when the semantic deck succeeds.** Avoids double-parsing the same slide XML through both `DOMParser` and the regex insight path.
- **Unresolved slides are no longer dropped.** `orderSlidesByPresentation` appends slides not matched by the presentation rels walk (instead of silently discarding them), and `readAttribute` now accepts single-quoted XML attributes.
- **No duplicate mode render.** The view-mode effect now depends only on `viewMode` and compares against an `activeViewModeRef`, eliminating the re-render that fired when `activeViewMode` state caught up.
- **`initialZoom` changes during load are applied.** After the viewer opens, the latest `initialZoomRef.current` is synced onto the viewer so a parent prop update that landed mid-load is no longer lost.
- **Localized fallback descriptions by default.** The semantic/summary fallback notices now show the localized description as the primary text and tuck the raw upstream `error.message` into an expandable "Error details" block.
- **`color-mix()` fallback.** Semantic/summary notice backgrounds now declare an `rgba()` fallback before the `color-mix()` rule for older browsers.

#### Consumer-callback isolation

- **`safelyInvoke` promoted to `core/safely-invoke.ts`** and applied to every consumer callback site: `PluginPreviewRenderer.onError` (unsupported path), `PreviewErrorBoundary.onError`, the PPTX adapter's `reportError`, and all PPTX callbacks. A throwing consumer callback can no longer escape a React effect/event handler. `pptx/safely-invoke.ts` remains as a deprecated re-export shim.

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
