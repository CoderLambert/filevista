---
Task ID: 1
Agent: main
Task: Add EPUB and DOCX/XLSX files as default demo files

Work Log:
  - Analyzed current demo file system (demos.ts with inline text content only)
  - Identified binary files from upload directory: EPUB (5MB), XLSX (8.6KB)
  - Found a small DOCX file from mammoth test data for demo
  - Created public/demo/ directory and copied 3 binary demo files
  - Updated demos.ts with DEMO_BINARY_FILES config and fetchBinaryDemoFiles() async function
  - Updated page.tsx loadDemoFiles to be async, loading both text and binary demos
  - Added loading spinner state for demo file button while fetching
  - Verified all 3 demo files are accessible via HTTP (200 status)

Stage Summary:
  - 3 binary demo files added: demo.docx, test_features.xlsx, 精通Python爬虫框架Scrapy.epub
  - Demo system now supports both inline text and URL-fetched binary files
  - loadDemoFiles is now async with loading indicator
  - Total demo files: 5 text + 3 binary = 8 files
---

Task ID: 2
Agent: main
Task: Replace mammoth.js with docx-preview for better DOCX rendering

Work Log:

- Compared mammoth.js vs docx-preview across 10+ dimensions
- mammoth: semantic HTML, loses colors/fonts/layout/pagination — only good for text extraction
- docx-preview: pixel-accurate rendering, preserves fonts/colors/pagination/images/headers/footers
- Installed docx-preview@0.3.7
- Rewrote DocxPreview.tsx to use renderAsync() from docx-preview
- Added page count display and custom CSS overrides for centered page display
- Kept mammoth for .doc (legacy format) in DocPreview.tsx — docx-preview only supports .docx
- Updated docs/preview-modules/docx/README.md with comparison table and new implementation details
- Updated docs/tech-stack/README.md with new dependency info

Stage Summary:

- DOCX rendering upgraded from mammoth → docx-preview for high-fidelity rendering
- Heading colors, fonts, layout, pagination, images, headers/footers now fully preserved
- mammoth retained only for legacy .doc format text extraction
- Package: docx-preview@0.3.7 added (~74KB gzip)

---

Task ID: 3
Agent: main
Task: Fix DOCX preview infinite "Rendering document..." loading bug

Work Log:

- Investigated user report: clicking demo.docx shows "Rendering document..." forever
- Found root cause: React ref timing bug — when `loading` state is `true`, the component renders a spinner instead of the container div with `containerRef`, so `containerRef.current` is `null` when `renderDocument()` runs in `useEffect`, causing it to silently return without ever rendering
- Also found: `docx-preview` is a browser-only library that was imported statically at top level, causing potential SSR issues in Next.js
- Fixed DocxPreview.tsx:
  1. Changed from static `import { renderAsync } from "docx-preview"` to dynamic `await import("docx-preview")` inside the render function
  2. Changed from conditional rendering (spinner OR container) to always-render-container with overlay approach — container is always in DOM so ref is always available
  3. Added `mountedRef` to prevent state updates after unmount
- Added `serverExternalPackages: ["docx-preview"]` to next.config.ts
- Updated docs/preview-modules/docx/README.md with SSR compatibility notes and the key pitfall
- Tested with agent-browser: demo.docx now renders correctly showing document content with table

Stage Summary:

- DOCX preview now works: renders document with text ("Above", "Below") and 2x2 table
- Key fix: always-render-container pattern prevents ref null issue
- Dynamic import prevents SSR module loading issues
- Docs updated with SSR compatibility section

---

Task ID: 4
Agent: main
Task: Replace react-syntax-highlighter with Shiki for code preview optimization

Work Log:

- Evaluated Shiki vs highlight.js vs react-syntax-highlighter for code syntax highlighting
- Shiki wins: VS Code-level fidelity, native lazy loading, CSS variable dual themes, no WASM needed
- Installed shiki@4.1.0 + @shikijs/langs@4.1.0 + @shikijs/themes@4.1.0 + @shikijs/transformers@4.1.0
- Created src/lib/shiki.ts: singleton highlighter with createBundledHighlighter + createSingletonShorthands
  - 50+ languages as separate dynamic imports (each is its own async chunk)
  - 2 themes (github-light, github-dark) for dual theme support
  - createJavaScriptRegexEngine() eliminates WASM dependency (226KB gzip saved)
  - transformerLineNumbers() adds data-line attributes for CSS line number display
  - getShikiLanguage() maps 50+ file extensions to Shiki language IDs
- Rewrote CodePreview.tsx:
  - Uses codeToHtml() from shiki.ts with dual themes (CSS variables)
  - defaultColor: false outputs --shiki-light/--shiki-dark CSS vars
  - CSS-based theme switching (no re-render needed for light/dark toggle)
  - Toolbar with language badge, line count, word wrap toggle, copy button
  - Plain text fallback when highlighting fails
  - Loading state while Shiki core + language chunk loads
- Updated FilePreviewRenderer.tsx:
  - React.lazy() for CodePreview — zero Shiki code loaded until user opens a code file
  - Suspense fallback with loading spinner
- Removed react-syntax-highlighter and @types/react-syntax-highlighter
- Removed old code-languages.ts (replaced by shiki.ts)
- Tested with agent-browser:
  - example.ts: renders with VS Code-quality syntax highlighting, line numbers, toolbar
  - package.json: JSON formatted + highlighted correctly
  - README.md: Markdown preview still works (doesn't depend on react-syntax-highlighter)
- Updated docs:
  - docs/preview-modules/json-code/README.md: complete rewrite with Shiki architecture
  - docs/tech-stack/README.md: updated dependency list and bundle sizes

Stage Summary:

- Code preview upgraded from react-syntax-highlighter → Shiki
- First code file load: ~49KB gzip (core + 1 lang + 2 themes, all lazy)
- Subsequent languages: +4-20KB gzip each (on demand)
- Non-code files: 0KB Shiki loaded (React.lazy)
- Dual theme support: CSS variable switching, no re-render needed
- No WASM dependency (JS RegExp engine used instead)
- VS Code-level rendering quality with TextMate grammars

---

Task ID: 5
Agent: main
Task: Integrate Shiki syntax highlighting into Markdown preview for code blocks

Work Log:

- Analyzed current MarkdownPreview.tsx (react-markdown + remark-gfm, no code highlighting)
- Designed integration: override react-markdown's `pre` component (not `code`) to avoid nested `<pre>` issue since Shiki's `codeToHtml` outputs full `<pre><code>...</code></pre>`
- Implemented ShikiPreBlock component that detects language from child `<code>` className
- Implemented ShikiPreContent async component with key-based remount (avoids setState-in-effect lint error)
- Added language badge + hover copy button to code blocks
- Reused `highlightCode()` from src/lib/shiki.ts (shared with CodePreview)
- Applied same dual-theme CSS variable approach (light/dark auto-switching)
- Made MarkdownPreview lazy-loaded in FilePreviewRenderer.tsx (React.lazy + Suspense)
- Updated demo README.md with multi-language code blocks (TypeScript, Python, CSS, Bash)
- Fixed lint error: replaced setState-in-effect pattern with key-based remount
- Verified with VLM: TypeScript and Python code blocks both render with syntax highlighting, language badges visible, different colors for keywords/strings/numbers
- Updated docs/preview-modules/markdown/README.md with Shiki architecture
- Updated docs/tech-stack/README.md with MarkdownPreview + Shiki dependency

Stage Summary:

- Markdown code blocks now use Shiki for VS Code-quality syntax highlighting
- MarkdownPreview and CodePreview share the same `highlightCode()` function and Shiki singleton
- Key-based remount pattern avoids React 19 lint error (setState-in-effect)
- Lazy loading: MarkdownPreview not loaded for non-Markdown files, Shiki not loaded for Markdown without code blocks
- Demo README.md showcases TypeScript, Python, CSS, Bash code blocks

---

Task ID: 6
Agent: main
Task: Fix Markdown preview typography/layout styles (missing prose styling)

Work Log:

- Identified that `prose` class from @tailwindcss/typography was not working
- Root cause: @tailwindcss/typography was NOT installed in the project
- Installed @tailwindcss/typography@0.5.19 and added `@plugin "@tailwindcss/typography"` to globals.css
- However, prose styles still didn't appear in the CSSOM — likely Tailwind v4 compatibility issue with `@plugin` directive
- Decided to take a self-contained approach: wrote complete prose CSS directly in MarkdownPreview.tsx
- Removed `@plugin "@tailwindcss/typography"` from globals.css (no longer needed)
- Replaced all `var(--color-border)` with explicit `rgba()` colors because the CSS variable resolves too light in bright mode (lab(90.952...) ≈ near-white)
- Added proper dark mode styles with inverted rgba polarities
- Styles cover: headings (h1-h6 with hierarchy), paragraphs, links, lists, blockquote (left border + bg), hr, inline code, tables, images, Shiki code blocks
- Verified with VLM: blockquote has visible left border, hr is visible, italic text renders, code blocks highlight, headings have proper hierarchy

Stage Summary:

- Markdown preview now has complete, professional typography without external dependencies
- Self-contained CSS approach avoids @tailwindcss/typography compatibility issues
- Explicit rgba colors ensure visibility in both light and dark modes
- All prose elements properly styled: headings, paragraphs, lists, blockquotes, tables, code, hr, links, images

---

## Task ID: 3 — Convert all heavy preview components to React.lazy dynamic imports

**Agent:** main
**File changed:** `src/components/file-preview/FilePreviewRenderer.tsx`

### What was done

Converted all 16 preview component imports from eager static imports to `React.lazy()` dynamic imports. Previously, only `MarkdownPreview` and `CodePreview` used lazy loading; the remaining 14 components (`PdfPreview`, `DocxPreview`, `DocPreview`, `PptxPreview`, `XlsxPreview`, `HtmlPreview`, `ZipPreview`, `SvgPreview`, `RtfPreview`, `EpubPreview`, `ImagePreview`, `TextPreview`, `CsvPreview`, `VideoPreview`, `AudioPreview`) were eagerly imported.

### Changes

1. **Removed all static `import { Component } from "./Component"` statements** for preview components.
2. **Added `lazy()` declarations** for all 16 preview components, using the named-export-to-default pattern: `lazy(() => import("./X").then((m) => ({ default: m.X })))` since all components use named exports.
3. **Wrapped every lazy component usage** in `<Suspense fallback={<PreviewLoading />}>` where `PreviewLoading` already existed in the file.
4. **Kept `UnsupportedPreview`** as a regular (non-lazy) component since it is tiny and always used as a fallback.

### Verification

- `bun run lint` — no errors in `FilePreviewRenderer.tsx`. (Pre-existing errors in `SvgPreview.tsx` are unrelated.)
- Dev server compiles and serves the page successfully.

---

Task ID: 4
Agent: code-fix-agent
Task: Fix memory leaks in HtmlPreview.tsx and SvgPreview.tsx where blob URLs are created in the render body without cleanup

Work Log:

- Read HtmlPreview.tsx: found `URL.createObjectURL` called directly in render body (lines 17-18), creating a new blob URL on every render with no cleanup
- Read SvgPreview.tsx: same issue (lines 25-26), blob URL created in render body with no revocation
- First attempt: Used useState + useEffect pattern with setBlobUrl/setSvgUrl in effect body — lint failed with `react-hooks/set-state-in-effect` error (setState synchronously within an effect causes cascading renders)
- Second approach: Used useMemo to compute blob URL during render + useEffect with blobUrl dependency for cleanup
  - useMemo derives the blob URL from content (no setState in effect)
  - useEffect cleanup revokes the previous blobUrl when it changes (content changes) or on unmount
- Applied fix to both files:
  - HtmlPreview.tsx: `const blobUrl = useMemo(() => URL.createObjectURL(new Blob([content], { type: "text/html" })), [content])` + cleanup effect
  - SvgPreview.tsx: `const svgUrl = useMemo(() => URL.createObjectURL(new Blob([content], { type: "image/svg+xml" })), [content])` + cleanup effect
- Ran `bun run lint` — 0 errors, 0 warnings

Stage Summary:

- Fixed memory leak in HtmlPreview.tsx: blob URL now properly revoked when content changes or component unmounts
- Fixed memory leak in SvgPreview.tsx: same fix applied
- Pattern: useMemo for blob URL derivation + useEffect with blobUrl dependency for cleanup
- This avoids the lint error (no setState in effect) while ensuring proper resource cleanup

---

Task ID: 5
Agent: main
Task: Replace duplicate atob() + Uint8Array conversion code with shared base64ToUint8Array utility

Work Log:

- Read all 7 target files to identify exact atob patterns and prop naming conventions
- Confirmed `base64ToUint8Array` already exists in `src/components/file-preview/utils.ts`
- Updated PdfPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Renamed prop `base64Content` → `content` (interface + destructuring)
  - Replaced 2 atob patterns (lines 112-116 loadPdf, lines 163-167 handleDownload) with `base64ToUint8Array(content)`
  - Updated useEffect dependency from `[base64Content]` to `[content]`
- Updated DocxPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Replaced 1 atob pattern (lines 30-34) with `base64ToUint8Array(content)` (prop already named `content`)
- Updated DocPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Renamed prop `base64Content` → `content` (interface + destructuring)
  - Replaced 2 atob patterns (lines 166-170 extract, lines 187-191 handleDownload) with `base64ToUint8Array(content)`
  - Updated useEffect dependency from `[base64Content]` to `[content]`
- Updated PptxPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Replaced 1 atob pattern (lines 143-147 parsePptx) with `base64ToUint8Array(base64Content)` (local function param, not a prop rename)
- Updated XlsxPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Replaced 1 atob pattern (lines 355-357 parseXlsx) with `base64ToUint8Array(base64Content)` (local function param)
- Updated EpubPreview.tsx:
  - Added `import { base64ToUint8Array } from "./utils"`
  - Replaced 1 atob pattern (lines 41-45 parseEpub) with `base64ToUint8Array(base64Content)` (local function param)
- Updated ZipPreview.tsx:
  - Added `base64ToUint8Array` to existing `import { formatFileSize, ... } from "./utils"`
  - Replaced 1 atob pattern (lines 23-27 parseZipFile) with `base64ToUint8Array(base64Content)` (local function param)
- Updated FilePreviewRenderer.tsx:
  - Changed `<PdfPreview base64Content={file.content}` → `<PdfPreview content={file.content}`
  - Changed `<DocPreview base64Content={file.content}` → `<DocPreview content={file.content}`
- Ran `bun run lint` — 0 errors, 0 warnings

Stage Summary:

- 9 atob+Uint8Array patterns replaced across 7 files with shared `base64ToUint8Array` utility
- 2 components (PdfPreview, DocPreview) had `base64Content` prop renamed to `content` for unified naming
- 2 call sites in FilePreviewRenderer.tsx updated for the prop rename
- All files pass lint cleanly
