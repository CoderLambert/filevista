---
"@lamberl-lee/file-preview": patch
---

HTML preview fixes: blob URL leak, ExcelJS ESM/CJS interop, security toggle.

### Fixed

- **HtmlPreview blob URL leak**: when `content` changed, the previous `useMemo` + `useEffect([blobUrl])` pattern caused React StrictMode to revoke URLs that were still mounted, producing iframe flashes. Replaced with `useState` + `useEffect([content])` so cleanup runs exactly once per content change.
- **ExcelJS ESM interop**: under bundler configs that wrap the CJS module as `{ default: Module }`, `EJS.Workbook` was `undefined` and XLSX preview crashed on load. Now resolves `mod.default?.Workbook ?? EJS.Workbook` with a typed cast covering both shapes.

### Added

- **HTML security toggle**: `HtmlPreview` now exposes a `safe` ↔ `trusted` switch in the view-mode bar. Default stays `safe` (no scripts, no forms, unique origin) — running untrusted HTML with scripts is a known XSS vector. Users can opt in to `trusted` (sandbox: `allow-scripts allow-same-origin allow-popups allow-forms`) for files they trust, with a warning banner explaining the risk. Three new i18n strings: `htmlEnableScripts`, `htmlDisableScripts`, `htmlTrustedModeHint` (zh-CN and en-US).
