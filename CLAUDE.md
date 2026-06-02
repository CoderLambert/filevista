# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FileVista** — 纯浏览器端文件预览工具集，支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等）。支持本地 File/Blob/ArrayBuffer 和远程 URL，面向 React/Vue/Svelte 等主流前端框架提供统一预览能力。所有处理均在客户端完成，文件不会离开用户设备。

Stack: **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui** + **Prisma** (SQLite).

## Development Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server on port 3000
bun run build            # Production build (creates standalone output)
bun run start            # Start production server
bun run lint             # Run ESLint
bun run db:push          # Push Prisma schema to database
bun run db:generate      # Generate Prisma client
bun run db:migrate       # Run Prisma migrations
```

## Architecture

### Layout

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, Toaster, metadata)
│   ├── page.tsx            # Main page — file upload/drop zone + sidebar + preview
│   ├── globals.css         # Tailwind + CSS variables
│   └── api/                # API routes (currently empty)
├── components/
│   ├── ui/                 # shadcn/ui components (button, badge, tabs, etc.)
│   └── file-preview/       # File type preview modules
│       ├── FilePreviewRenderer.tsx   # TabCacheRenderer — switches between preview components
│       ├── utils.ts                  # FileType detection, FileInfo interface, helpers
│       ├── demos.ts                  # Demo file content (text inline + binary from /public)
│       ├── code-languages.ts         # Code language detection rules
│       ├── CodePreview.tsx           # Code highlighting via Shiki
│       ├── MarkdownPreview.tsx       # Markdown rendering
│       ├── PdfPreview.tsx            # PDF.js rendering
│       ├── DocxPreview.tsx           # docx-preview rendering
│       ├── DocPreview.tsx            # mammoth for legacy .doc
│       ├── PptxPreview.tsx           # PPTX rendering
│       ├── XlsxPreview.tsx           # Excel/spreadsheet rendering
│       ├── EpubPreview.tsx           # EPUB reader
│       ├── ZipPreview.tsx            # ZIP file browser
│       ├── SvgPreview.tsx            # SVG viewer
│       ├── ImagePreview.tsx          # Image viewer
│       ├── HtmlPreview.tsx           # HTML sandbox
│       ├── CsvPreview.tsx            # CSV table viewer
│       ├── ShikiSourceView.tsx       # Source code view with syntax highlighting
│       └── *Preview.tsx              # Audio, Video, RTF, Text previews
├── lib/
│   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── db.ts               # Prisma client (singleton pattern)
│   └── shiki.ts            # Shiki highlighter config + ext→lang mapping
└── hooks/
    ├── use-mobile.ts       # Responsive breakpoint hook
    └── use-toast.ts        # Toast notification hook
```

### Key Patterns

- **File detection**: `detectFileType()` in `file-preview/utils.ts` maps filename/MIME → `FileType` union type
- **Preview rendering**: `TabCacheRenderer` in `FilePreviewRenderer.tsx` mounts all file preview components simultaneously and toggles visibility via CSS `display` — this prevents re-parsing expensive formats (PDF/DOCX/XLSX) on tab switches
- **Binary vs text files**: Binary files are read as base64 or object URLs; text files are read as strings. The `processFile` callback in `page.tsx` handles this branching
- **Shiki code highlighting**: Lazy-loaded via main entry — only used languages/themes are code-split. Config in `src/lib/shiki.ts`
- **State management**: Zustand for global state, React state/hooks for local UI state
- **Database**: Prisma + SQLite (User/Post models — scaffold only, not used by the preview feature)

### shadcn/ui

Components are installed via the "new-york" style variant at `@/components/ui/`. Path aliases use `@/*` → `./src/*`. Add new components with:

```bash
npx shadcn@latest add <component>
```

## Deployment

The app builds to a standalone output (`.next/standalone/`) for Docker/Node deployment. The `build` script handles copying static assets. Caddy is configured as a reverse proxy on port 81 (see `Caddyfile`).
