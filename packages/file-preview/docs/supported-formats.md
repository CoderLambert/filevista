# Supported formats

> **Read this before integrating.** This page describes the *boundaries* of
> what the library can render. The headline list of "20+ formats" only buys
> you so much — the realistic limits below are what you will actually
> encounter in production.
>
> Source of truth for the per-format status: `PREVIEW_SUPPORT_MATRIX` in
> `support-status.ts`. Anything here disagreeing with the code is a doc
> bug.

---

## 1 · Quick reference table

| Format | Status | Underlying renderer | What we render | What we **don't** guarantee |
| --- | --- | --- | --- | --- |
| **PDF** | ✅ supported | [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist) | Pages, text selection, basic forms | Form submission, annotations editing, embedded JavaScript |
| **DOCX** | ✅ supported | [`docx-preview`](https://www.npmjs.com/package/docx-preview) | Body text, lists, tables, inline images | Pixel-identical Word rendering, comments, tracked changes, complex section breaks |
| **XLSX** | ✅ supported | [`exceljs`](https://www.npmjs.com/package/exceljs) | Sheets, cells, basic formatting, **stored** formula results | Formula recalculation, charts, pivot tables, conditional-format rendering, macros |
| **PPTX** | ✅ supported | [`pptx-preview`](https://www.npmjs.com/package/pptx-preview) | Slide thumbnails, text, layouts | Animations, transitions, embedded video, complex masters, EMF/WMF images |
| **EPUB** | ✅ supported | [`jszip`](https://www.npmjs.com/package/jszip) + custom | Chapters, table of contents, embedded images | DRM-protected EPUBs, fixed-layout EPUBs, audio/video embeds |
| **RTF** | ✅ supported | [`rtf.js`](https://www.npmjs.com/package/rtf.js) | Rich text, WMF/EMF vectors via embedded engine | Anything `rtf.js` itself can't parse — falls back to plain-text view automatically |
| **Markdown** | ✅ supported | `react-markdown` + `remark-gfm` + Shiki | GFM (tables, task lists, fenced code with syntax highlighting), HTML in MD is sanitized | Custom MDX components, raw `<script>` (stripped) |
| **HTML** | ✅ supported | DOMPurify + `<iframe sandbox>` | Sanitized HTML preview + raw source view | Inline scripts, external resource loads (sandbox blocks them by default) |
| **SVG** | ✅ supported | DOMPurify + sanitized `<img>` / inline | Scaled vector preview, source view | Inline scripts (stripped), external `<image href="…">` referencing untrusted hosts |
| **Code** (50+ languages) | ✅ supported | [Shiki](https://shiki.matsu.io/) | Token-accurate syntax highlighting, line numbers | Code execution, language server features (hover, jump-to-def) |
| **JSON** | ✅ supported | Shiki (routed through source-code plugin) | Syntax highlighting, line numbers | Schema-aware tree view, JSON-Path search |
| **Plain text** | ✅ supported | built-in | Line numbers, word wrap, large-file streaming view | Encoding auto-detection beyond UTF-8 BOM |
| **CSV** | ✅ supported | built-in | Sortable table | Multi-million-row datasets (use the streaming text view) |
| **Image** (png/jpg/gif/webp/avif/…) | ✅ supported | browser-native | Zoom, rotate, fit-to-screen | TIFF, HEIC, RAW formats |
| **Audio / Video** | ✅ supported | browser-native `<audio>` / `<video>` | Playback for codecs the browser supports | Codec compatibility (MOV/HEVC/HEIF on non-Apple browsers) |
| **ZIP** | ⚠️ listing only | `jszip` | Entry tree, sizes, contents browsing | Auto-recursive preview of inner files (intentional — would amplify zip-bombs) |
| **DOC** (legacy) | ⚠️ degraded | none | Plain-text extraction only | Layout, images, formatting. Convert to `.docx` for full preview. |
| **PPT** (legacy) | ❌ not supported | — | — | Convert to `.pptx`. |
| **XLS** (legacy) | ❌ not supported | — | — | Convert to `.xlsx`. |

> ✅ supported · ⚠️ supported with a documented limit · ❌ not supported

---

## 2 · What "supported" actually means

Browser-side parsing of office formats is **best-effort visual approximation**,
not faithful reproduction of the desktop apps. The library deliberately does
not promise:

- **Pixel-perfect Word/Excel/PowerPoint output.** No browser can fully
  emulate desktop rendering — fonts differ, paginations drift, complex
  layouts simplify.
- **Formula recomputation in XLSX.** We display whatever values are stored
  in the file. If you need fresh recomputation, run a server-side process.
- **Macros, scripts, executable content.** Macros in `.xlsm` / `.docm`,
  PDF JavaScript, embedded `.exe` payloads — all ignored or stripped.
  This is a security feature, not a missing feature.
- **PowerPoint animations / transitions / embedded media playback.**
- **Identical output across browsers.** Audio/video codec support, color
  management, and font fallback differ.
- **DRM-protected content** of any kind.

Setting consumer expectations early (in your product UI) avoids "your
preview doesn't match Word!" support tickets. We strongly recommend
labeling office previews as "preview" rather than "view" and offering a
download button as a peer to the preview.

---

## 3 · Security posture

- **HTML, SVG, RTF**: all run through DOMPurify; HTML additionally renders
  inside `<iframe sandbox>` (no `allow-scripts`, `allow-same-origin`,
  etc.) so embedded scripts can't reach your page.
- **PDF**: `pdfjs-dist` renders the document content but does not execute
  embedded PDF JavaScript by default.
- **ZIP**: only the entry list is parsed; inner files aren't auto-decoded.
  This is deliberate — auto-decompressing nested archives is the classic
  zip-bomb vector.
- **All renderers** read from a `PreviewSource` (file/blob/arrayBuffer/url).
  When the source is `url`, `processRemoteUrl` enforces `maxBytes`
  (default 100 MB) and rejects oversize bodies before they hit memory.

---

## 4 · Performance limits

The library applies a built-in `LargeFileGate` (since 0.3.0) to every
preview rendered via `<PluginPreviewRenderer>`:

| File size | Behavior |
| --- | --- |
| **< 20 MB** | Renders normally |
| **20–50 MB** | Renders with a non-blocking "may be slower" banner |
| **50–100 MB** | Requires explicit confirmation ("Preview anyway") |
| **≥ 100 MB** | Refuses to preview; offers download only |

Disable via `<PluginPreviewRenderer largeFilePolicy="off" />` if you need
to (e.g. trusted internal-only content with bounded sizes).

For remote URLs, `processRemoteUrl({ maxBytes })` enforces a parallel cap
during download — even if `LargeFileGate` is off, an unbounded URL can't
exhaust memory:

- Server sends `Content-Length` larger than `maxBytes` → rejected
  pre-flight, zero bytes transferred.
- Server omits `Content-Length` → reader is aborted the moment received
  bytes cross `maxBytes`.

---

## 5 · Optional peer dependencies

To preview the heavy formats you must also install the format's peer
dependency. Without it, the matched plugin throws a
`MissingPeerDependencyError` with an install hint instead of a cryptic
bundler error:

| Format | Add this peer dep |
| --- | --- |
| PDF | `pdfjs-dist` (^4.4.0) |
| DOCX | `docx-preview` (^0.3.7) |
| XLSX | `exceljs` (^4.4.0) |
| PPTX | `pptx-preview` (^1.0.7) |
| RTF | `rtf.js` (^3.0.9) |
| ZIP / EPUB | `jszip` (^3.10.1) |

The base install only ships dompurify / react-markdown / remark-gfm /
shiki — enough for Markdown / HTML / SVG / code / image / video / audio /
CSV / JSON / plain text out of the box.

---

## 6 · Browser support

| Browser | Minimum |
| --- | --- |
| Chrome / Edge | 90+ |
| Firefox | 88+ |
| Safari | 14+ |

The library uses `File`/`Blob`/`ArrayBuffer`, `fetch`, `URL.createObjectURL`,
dynamic `import()`, and `crypto.randomUUID()`. PDF preview additionally
spawns a Web Worker. No polyfills are shipped — older browsers need the
relevant polyfills from the consumer.
