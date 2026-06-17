---
"@lamberl-lee/file-preview": minor
---

Production-readiness pass for safer SDK integration.

Highlights:
- React 18 compatibility: `PluginPreviewRenderer` no longer uses React 19-only `use(promise)`; CI now runs the library tests under React 18.3.1.
- Built-in large-file gate: `PluginPreviewRenderer` now protects previews by default (20 MB warn, 50 MB confirm, 100 MB block) with `largeFilePolicy="off"` for custom policies.
- Remote URL safety: `processRemoteUrl` now has `maxBytes` (default 100 MB) and rejects oversize downloads via Content-Length preflight or mid-stream abort.
- Local magic-byte detection: new `detectFileMeta(source)` plus shared `sniffMagic` / `sniffZipContainer` helpers detect PDF/images/ZIP Office containers/OLE before falling back to filename or MIME.
- Standard error contract: new `PreviewError` / `PreviewErrorCode` and `PluginPreviewRenderer.onError` so consumers can switch on stable error codes instead of parsing messages.
- Documentation: added `docs/supported-formats.md` to clarify supported formats, limitations, security posture, size limits, and optional peer dependencies.
