# @lamberl-lee/file-preview

[![npm version](https://img.shields.io/npm/v/@lamberl-lee/file-preview.svg?style=flat-square)](https://www.npmjs.com/package/@lamberl-lee/file-preview)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@lamberl-lee/file-preview?style=flat-square&label=gzip)](https://bundlephobia.com/package/@lamberl-lee/file-preview)
[![license](https://img.shields.io/npm/l/@lamberl-lee/file-preview?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/CoderLambert/filevista/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/CoderLambert/filevista/actions/workflows/ci.yml)

> Browser-side file preview toolkit for React — 20+ formats with zero server processing.

Render PDF, DOCX, PPTX, XLSX, EPUB, RTF, Markdown, code, images, video, audio, ZIP, CSV, SVG, HTML, and plain text — all in the browser. Files never leave the user's device.

## Install

```bash
npm install @lamberl-lee/file-preview
# or pnpm add / yarn add
```

The base install only ships what every consumer needs: Markdown, code highlighting (Shiki), HTML sanitization (DOMPurify), and the always-included image / video / audio / SVG / CSV / plain-text / JSON renderers.

To preview the heavier formats, install **only the optional peer dependencies for the formats you actually use**:

| Format | Add this peer dep | Approx size (gzipped) |
| --- | --- | --- |
| PDF | `pdfjs-dist` (^4.4.0) | ~280 KB worker, lazy-loaded |
| DOCX | `docx-preview` (^0.3.7) | ~45 KB |
| XLSX | `exceljs` (^4.4.0) | ~250 KB |
| PPTX | `@aiden0z/pptx-renderer` (^1.2.0) | Large dependency, dynamically loaded on demand |
| RTF | `rtf.js` (^3.0.9) | ~120 KB worker, lazy-loaded |
| ZIP / EPUB | `jszip` (^3.10.1) | ~30 KB |

```bash
# Example: only PDF + Markdown previews
pnpm add @lamberl-lee/file-preview pdfjs-dist
```

If a user uploads a format whose peer dep is missing, the preview falls back to a clear "install `<package>`" message instead of a cryptic bundler error. So you can ship safely with just the formats you need.

`react` and `react-dom` (>=18.2) are also peer dependencies.

## Quick start

```tsx
import {
  PluginPreviewRenderer,
  detectFileType,
  setAssetBasePath,
  type FileInfo,
} from "@lamberl-lee/file-preview";
import "@lamberl-lee/file-preview/styles/index.css";

// Tell the library where PDF.js worker / RTF.js bundles are served from.
// (See "Static assets" below.) Empty string means same origin / "/".
setAssetBasePath("");

function Demo({ file }: { file: File }) {
  const info: FileInfo = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    fileType: detectFileType(file.name, file.type),
    source: { kind: "file", file },
  };

  return <PluginPreviewRenderer file={info} />;
}
```

### Remote URL

```tsx
import { processRemoteUrl } from "@lamberl-lee/file-preview";

const info = await processRemoteUrl("https://example.com/foo.pdf", {
  onProgress: (p) => console.log(p),
});
```

## Static assets (PDF.js worker, RTF.js bundles)

PDF and RTF previews need extra runtime assets that must be served from a static path. The package ships two helper scripts:

```jsonc
// package.json
{
  "scripts": {
    "postinstall": "node node_modules/@lamberl-lee/file-preview/scripts/copy-pdf-worker.mjs && node node_modules/@lamberl-lee/file-preview/scripts/copy-rtfjs-bundles.mjs"
  }
}
```

These copy:

- `pdfjs-dist/build/pdf.worker.min.mjs` → `public/vendor/pdfjs/pdf.worker.min.mjs`
- `rtf.js/dist/{WMFJS,EMFJS,RTFJS}.bundle.min.js` → `public/vendor/rtfjs/`

Skip the `copy-pdf-worker.mjs` line if you don't install `pdfjs-dist`, and the `copy-rtfjs-bundles.mjs` line if you don't install `rtf.js` — both scripts are no-ops when the source package is missing.

Then call `setAssetBasePath()` once at app startup to match the public path you serve them from (e.g. `""` for root, `"/static"` for a CDN prefix, or `"/myapp"` for a Next.js `basePath`).

## Theming

Override CSS variables on the document root:

```css
[data-fv-theme="dark"] {
  --fv-bg: #0b0b0c;
  --fv-fg: #e7e7e7;
  --fv-border: #2a2a2c;
  --fv-primary: #4f8cff;
  /* … */
}
```

## i18n

```tsx
import { LocaleProvider, enUS } from "@lamberl-lee/file-preview";

<LocaleProvider value={enUS}>
  <PluginPreviewRenderer file={info} />
</LocaleProvider>
```

Built-in locales: `zhCN` (default), `enUS`. Pass a fully custom `LocaleMessages` object to localize.

## Custom plugin registry

Drop or replace formats:

```tsx
import {
  createPreviewPluginRegistry,
  pdfPlugin,
  markdownPlugin,
  imagePlugin,
} from "@lamberl-lee/file-preview";

const registry = createPreviewPluginRegistry([pdfPlugin, markdownPlugin, imagePlugin]);

<PluginPreviewRenderer file={info} registry={registry} />;
```

A registry built from a subset of plugins also means the bundler will tree-shake away the formats you don't include.

## Supported formats

PDF · DOCX · PPTX · XLSX · EPUB · RTF · Markdown · HTML · code (Shiki-highlighted) · plain text · CSV · JSON · SVG · images · video · audio · ZIP listing.

> **Before integrating, read [`docs/supported-formats.md`](./docs/supported-formats.md).**
> It documents *what each format actually renders* — and, more importantly, what it
> doesn't (no PowerPoint animations, no XLSX formula recomputation, DOC/PPT/XLS
> legacy formats are downgrades, etc.). Reading this prevents the most common
> integration disappointments.

## Browser support

| Browser | Minimum |
| --- | --- |
| Chrome / Edge | 90+ |
| Firefox | 88+ |
| Safari | 14+ |

The library relies on browser-native `File`/`Blob`/`ArrayBuffer`, `fetch`, `URL.createObjectURL`, and dynamic `import()`. PDF preview additionally uses a Web Worker (PDF.js). No polyfills are shipped — if you need to support older browsers, add the relevant polyfills yourself.

## License

LGPL-3.0-or-later — see `LICENSE` (LGPL-3.0) and `COPYING` (GPL-3.0, which LGPL-3.0 extends).

You can use this package in proprietary applications without making your application LGPL — that's exactly what the L (Lesser) in LGPL is for. The obligation only applies if you ship a modified version of this library itself.
