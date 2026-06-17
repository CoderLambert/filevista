# @filevista/file-preview

> Browser-side file preview toolkit for React — 20+ formats with zero server processing.

Render PDF, DOCX, PPTX, XLSX, EPUB, RTF, Markdown, code, images, video, audio, ZIP, CSV, SVG, HTML, and plain text — all in the browser. Files never leave the user's device.

## Install

```bash
npm install @filevista/file-preview
# or pnpm / yarn
```

`react` and `react-dom` (>=18.2) are peer dependencies.

## Quick start

```tsx
import {
  PluginPreviewRenderer,
  detectFileType,
  generateId,
  setAssetBasePath,
  type FileInfo,
} from "@filevista/file-preview";
import "@filevista/file-preview/styles/index.css";

// Tell the library where PDF.js worker / RTF.js bundles are served from.
// (See "Static assets" below.) Empty string means same origin / "/".
setAssetBasePath("");

function Demo({ file }: { file: File }) {
  const info: FileInfo = {
    id: generateId(),
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
import { processRemoteUrl } from "@filevista/file-preview";

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
    "postinstall": "node node_modules/@filevista/file-preview/scripts/copy-pdf-worker.mjs && node node_modules/@filevista/file-preview/scripts/copy-rtfjs-bundles.mjs"
  }
}
```

These copy:

- `pdfjs-dist/build/pdf.worker.min.mjs` → `public/vendor/pdfjs/pdf.worker.min.mjs`
- `rtf.js/dist/{WMFJS,EMFJS,RTFJS}.bundle.min.js` → `public/vendor/rtfjs/`

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
import { LocaleProvider, enUS } from "@filevista/file-preview";

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
} from "@filevista/file-preview";

const registry = createPreviewPluginRegistry([pdfPlugin, markdownPlugin, imagePlugin]);

<PluginPreviewRenderer file={info} registry={registry} />;
```

## Supported formats

PDF · DOCX · PPTX · XLSX · EPUB · RTF · Markdown · HTML · code (Shiki-highlighted) · plain text · CSV · JSON · SVG · images · video · audio · ZIP listing.

## License

MIT
