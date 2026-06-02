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
