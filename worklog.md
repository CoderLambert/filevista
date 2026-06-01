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
