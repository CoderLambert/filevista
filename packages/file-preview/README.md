# @lamberl-lee/file-preview

[![npm version](https://img.shields.io/npm/v/@lamberl-lee/file-preview.svg?style=flat-square)](https://www.npmjs.com/package/@lamberl-lee/file-preview)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@lamberl-lee/file-preview?style=flat-square&label=gzip)](https://bundlephobia.com/package/@lamberl-lee/file-preview)
[![license](https://img.shields.io/npm/l/@lamberl-lee/file-preview?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/CoderLambert/filevista/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/CoderLambert/filevista/actions/workflows/ci.yml)

**A React file viewer for 20+ formats, rendered entirely in the browser with no server uploads.**

Render PDF, DOCX, PPTX, XLSX, EPUB, RTF, Markdown, code, images, video, audio, ZIP, CSV, SVG, HTML, and plain text — all in the browser. Files never leave the user's device.

[Live demo](https://coderlambert.github.io/filevista/) · [GitHub](https://github.com/CoderLambert/filevista) · [Quick start](#quick-start) · [Supported formats](#supported-formats)

## Why FileVista?

- One React API for documents, Office files, code, ebooks, archives, images, audio, and video.
- Browser-only rendering with no FileVista upload or conversion server.
- Lightweight base entry plus opt-in PDF and Office plugins with optional peer dependencies.
- Local `File`, `Blob`, and `ArrayBuffer` sources, plus CORS-enabled remote URLs.
- Large-file controls, safe HTML preview, theming, error hooks, and Chinese/English locales.

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

The root entry ships only the **base** formats — Markdown, code, HTML, JSON,
CSV, SVG, plain text, images, audio, video. None of the heavy optional peer
dependencies (PDF.js, JSZip, etc.) are reachable from this entry, so
`import { PluginPreviewRenderer } from "@lamberl-lee/file-preview"` stays small
by default.

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

  // Renders base formats only — PDF/DOCX/PPTX/XLSX/RTF/ZIP/EPUB will be
  // reported as unsupported until you wire up the /full registry (below).
  return <PluginPreviewRenderer file={info} />;
}
```

## Choose your setup

| Setup | Included formats | Import |
| --- | --- | --- |
| Base | Markdown, code, HTML, JSON, CSV, SVG, text, images, audio, video | `@lamberl-lee/file-preview` |
| Full | Base plus PDF, DOCX, PPTX, XLSX, RTF, ZIP, EPUB | `@lamberl-lee/file-preview/full` |
| Individual plugins | Base plus only the heavy formats selected by your app | `@lamberl-lee/file-preview/plugins/*` |

### Integration checklist

1. Import `@lamberl-lee/file-preview/styles/index.css` once in your app.
2. Build a `FileInfo` from your `File`, `Blob`, `ArrayBuffer`, or remote URL source.
3. Render `<PluginPreviewRenderer file={info} />` for base formats.
4. For PDF / DOCX / PPTX / XLSX / RTF / ZIP / EPUB, install only the peer dependencies you need and pass a registry from `/full` or `/plugins/*`.
5. If you use PDF or RTF, copy their runtime assets into your public directory and call `setAssetBasePath()` at startup.
6. Keep the default `largeFilePolicy`, or set your own warning / confirm / block thresholds for large files.
7. For HTML full preview, wire `onHtmlTrustedPreviewRequest` and ask the user for confirmation before calling `request.confirm()`.

### Heavy formats (PDF / DOCX / PPTX / XLSX / RTF / ZIP / EPUB)

Install the relevant optional peer dependencies, then opt into the heavy
formats via the `/full` subpath export:

```tsx
import {
  PluginPreviewRenderer,
  detectFileType,
  setAssetBasePath,
  type FileInfo,
} from "@lamberl-lee/file-preview";
import { createFullPreviewRegistry } from "@lamberl-lee/file-preview/full";
import "@lamberl-lee/file-preview/styles/index.css";

setAssetBasePath("");

const registry = createFullPreviewRegistry();

function Demo({ file }: { file: File }) {
  const info: FileInfo = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    fileType: detectFileType(file.name, file.type),
    source: { kind: "file", file },
  };

  return <PluginPreviewRenderer file={info} registry={registry} />;
}
```

### HTML preview safety modes

HTML files open in **safe preview** by default. In this mode the iframe sandbox
does not allow scripts, forms, popups, or same-origin access, so unknown HTML can
be inspected with lower risk.

If your product wants to offer an interactive "full preview" mode, wire
`onHtmlTrustedPreviewRequest` and show your own confirmation UI. Call
`request.confirm()` only after the user accepts:

```tsx
import { useState } from "react";
import {
  PluginPreviewRenderer,
  type FileInfo,
  type HtmlTrustedPreviewRequest,
} from "@lamberl-lee/file-preview";

function Preview({ file }: { file: FileInfo }) {
  const [pendingHtmlRequest, setPendingHtmlRequest] =
    useState<HtmlTrustedPreviewRequest | null>(null);

  return (
    <>
      <PluginPreviewRenderer
        file={file}
        onHtmlTrustedPreviewRequest={setPendingHtmlRequest}
      />

      {pendingHtmlRequest && (
        <ConfirmDialog
          title="Enable full HTML preview?"
          description="Scripts inside this HTML file will be allowed to run."
          onCancel={() => {
            pendingHtmlRequest.cancel();
            setPendingHtmlRequest(null);
          }}
          onConfirm={() => {
            pendingHtmlRequest.confirm();
            setPendingHtmlRequest(null);
          }}
        />
      )}
    </>
  );
}
```

Use full preview only for files whose source you trust. Safe preview and source
view remain available without enabling scripts.

Need only a subset of heavy formats? Import the individual plugins from their
own subpath so the bundler never touches the rest:

```tsx
import {
  PluginPreviewRenderer,
  createPreviewPluginRegistry,
  createBasePreviewRegistry,
} from "@lamberl-lee/file-preview";
import { pdfPlugin } from "@lamberl-lee/file-preview/plugins/pdf";
import { pptxPlugin } from "@lamberl-lee/file-preview/plugins/pptx";

// Base formats + just PDF and PPTX.
const registry = createPreviewPluginRegistry([
  ...createBasePreviewRegistry().list(), // or build your own list
  pdfPlugin,
  pptxPlugin,
]);

<PluginPreviewRenderer file={info} registry={registry} />;
```

> **0.4.0 migration:** In 0.3.x the root entry exported every plugin
> (`pdfPlugin`, `pptxPlugin`, …) and `<PluginPreviewRenderer>` defaulted to
> the full registry. In 0.4.0 those heavy exports moved to `/full` and
> `/plugins/*`, and the default registry is now base-only. If you previously
> relied on heavy formats from the root entry, add the `registry={createFullPreviewRegistry()}`
> prop (and the `import { createFullPreviewRegistry } from "@lamberl-lee/file-preview/full"`
> line).

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

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| PDF or Office file is reported as unsupported | Install the relevant optional peer and pass the `/full` or individual plugin registry. |
| `pdf.worker.min.mjs` cannot be loaded | Run the PDF worker copy script and make `setAssetBasePath()` match the deployed public path. |
| RTF reports missing runtime bundles | Run the RTF.js copy script and serve the generated files from `public/vendor/rtfjs`. |
| A remote URL fails while a local file works | The remote server must permit the browser request through CORS. Use your own backend proxy when it does not. |
| A large file is warned, confirmed, or blocked | Configure `largeFilePolicy`; use `"off"` only when the host application enforces its own limits. |
| The viewer has no styling | Import `@lamberl-lee/file-preview/styles/index.css` once in the application. |

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

Drop or replace formats. Heavy plugins come from their own `/plugins/*`
subpath; base plugins live on the root entry:

```tsx
import {
  createPreviewPluginRegistry,
  markdownPlugin,
  imagePlugin,
} from "@lamberl-lee/file-preview";
import { pdfPlugin } from "@lamberl-lee/file-preview/plugins/pdf";

const registry = createPreviewPluginRegistry([pdfPlugin, markdownPlugin, imagePlugin]);

<PluginPreviewRenderer file={info} registry={registry} />;
```

A registry built from a subset of plugins also means the bundler will tree-shake away the formats you don't include.

## Supported formats

PDF · DOCX · PPTX · XLSX · EPUB · RTF · Markdown · HTML · code (Shiki-highlighted) · plain text · CSV · JSON · SVG · images · video · audio · ZIP listing.

> **Before integrating, read [`docs/supported-formats.md`](https://github.com/CoderLambert/filevista/blob/main/packages/file-preview/docs/supported-formats.md).**
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
