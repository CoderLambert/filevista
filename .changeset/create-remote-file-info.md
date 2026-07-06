---
"@lamberl-lee/file-preview": minor
---

`createRemoteFileInfo()` — build a `FileInfo` for a remote URL using metadata the caller already has (e.g. a backend file listing that returns `name` + `size` without downloading the body).

### Added

- **`createRemoteFileInfo({ name, size, url, mimeType?, headers?, id? })`**: new public helper in `remote-url.ts`. Unlike `processRemoteUrl()`, this does NOT fetch — the size is taken from caller-supplied metadata, so `LargeFileGate` can apply warning / confirm / block thresholds before any network traffic starts. The download happens lazily, when a preview plugin calls `readSourceAsArrayBuffer(source)` / `readSourceAsText(source)`.

### Trade-offs vs `processRemoteUrl()`

| Capability | `processRemoteUrl()` | `createRemoteFileInfo()` |
|------------|----------------------|--------------------------|
| Size detection timing | After download | At metadata arrival |
| Network requests | Eagerly fetches the body | Lazy — only when the plugin renders |
| MIME sniffing | magic bytes + extension + Content-Type | Extension only (or caller-supplied `mimeType`) |
| 100 MB hard cap | Built-in (`DEFAULT_REMOTE_MAX_BYTES`) | None — caller controls via `largeFilePolicy.maxBytes` |
| Download progress | `onProgress` callback | None |
| Error normalization | Typed `RemoteUrlError` with `code` | Plain `Error` from `readSourceAsArrayBuffer` |

### Use case

Backend file listings that already return `size` (e.g. `{ "name": "report.pptx", "size": 10152828, "last_modified": 1782957982 }`). Wire the metadata straight into the preview gate so oversized files are blocked at click time, before any bytes are transferred.
