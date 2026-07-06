---
"@lamberl-lee/file-preview": minor
---

Configurable large file policy + detached-ArrayBuffer crash fix.

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
