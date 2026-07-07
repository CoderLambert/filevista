---
"@lamberl-lee/file-preview": patch
---

### Fixed

- **HtmlPreview securityMode reload**: toggling `securityMode` between `safe` and `trusted` updated the iframe `sandbox` attribute, but because `src` (blob URL) did not change, the browser did not reload the iframe content — so the new sandbox policy was not actually applied (in `safe → trusted`, scripts stayed blocked; in `trusted → safe`, already-running scripts kept running). The iframe now uses `key={securityMode}` so React unmounts and remounts it on mode switch, forcing a fresh load under the new sandbox.
- **Empty `src` warning on first render**: the iframe rendered with `src=""` on the first frame (before the blob URL effect ran), triggering a console warning about re-downloading the page. The iframe is now conditionally rendered only after `blobUrl` is set.
