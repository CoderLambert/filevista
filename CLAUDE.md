# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FileVista** — 纯浏览器端文件预览工具集，支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等）。支持本地 File/Blob/ArrayBuffer 和远程 URL，面向 React/Vue/Svelte 等主流前端框架提供统一预览能力。所有处理均在客户端完成，文件不会离开用户设备。

Stack: **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4** + **shadcn/ui**. 100% client-side — no database, no server-side file processing.

## Development Commands

```bash
pnpm install             # Install dependencies
pnpm run dev             # Start dev server on port 3000
pnpm run build           # Production build (creates standalone output)
pnpm run start           # Start production server (Node runtime)
pnpm run lint            # Run ESLint
pnpm run typecheck       # Run TypeScript type-check
pnpm run test            # Run Vitest tests
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
│   └── file-preview/       # File type preview modules (framework-agnostic)
│       ├── core/            # Pure logic — types, plugin registry, source abstraction, config
│       │   ├── types.ts     # PreviewSource, NormalizedFile
│       │   ├── plugin.ts    # PreviewPlugin interface
│       │   ├── registry.ts  # PreviewPluginRegistry class
│       │   ├── source.ts    # readSourceAs* utilities
│       │   ├── binary.ts    # readBinaryPreviewAs* helpers
│       │   ├── download.ts  # downloadSource helper
│       │   └── config.ts    # Asset base path configuration (setAssetBasePath/resolveAssetPath)
│       │   └── i18n.ts      # Locale messages (zhCN/enUS) + LocaleProvider + useLocale()
│       ├── hooks/           # React hooks for source reading
│       ├── plugins/         # 16 built-in preview plugins + builtin-plugins.ts
│       ├── preview-adapters/# Adapter components bridging plugins → preview components
│       ├── styles/          # CSS files — fv- prefixed BEM classes + CSS variables
│       │   ├── base.css     # Design tokens + shared components (fv-btn, fv-spinner, etc.)
│       │   ├── index.css    # Barrel import for all styles
│       │   └── *.css        # Per-component stylesheets
│       ├── icons.tsx        # 25 inline SVG icon components (zero dependencies)
│       ├── shiki.ts         # Shiki highlighter config (local copy, no @/ imports)
│       ├── PluginPreviewRenderer.tsx  # Plugin-based renderer with Suspense + ErrorBoundary
│       ├── utils.ts         # FileType detection, FileInfo interface, helpers
│       ├── demos.ts         # Demo file content (text inline + binary from /public)
│       ├── support-status.ts # Preview support matrix
│       ├── performance-limits.ts # Large file policy
│       ├── limits.ts        # Shiki/display size limits
│       ├── remote-url.ts    # URL loading + magic sniffing
│       └── *Preview.tsx     # Individual preview components (PDF, DOCX, etc.)
├── lib/
│   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   └── shiki.ts            # Shiki highlighter config (used by app layer)
└── hooks/
    ├── use-mobile.ts       # Responsive breakpoint hook
    └── use-toast.ts        # Toast notification hook
```

### Key Patterns

- **File detection**: `detectFileType()` in `file-preview/utils.ts` maps filename/MIME → `FileType` union type
- **Plugin architecture**: `PreviewPlugin` interface + `PreviewPluginRegistry` — each file type is a self-contained plugin with `match()` + `load()` (dynamic import). 16 built-in plugins registered in `plugins/builtin-plugins.ts`
- **Preview rendering**: `PluginPreviewRenderer` uses React 19 `use()` + `Suspense` to lazily load plugin modules. Error boundary catches load/render failures
- **Source abstraction**: `PreviewSource` union type (file / blob / arrayBuffer / url) — preview components never access raw file data directly, they use `readSourceAsText()`, `readSourceAsArrayBuffer()`, or the `useSourceText` / `useObjectUrlFromSource` hooks
- **Binary vs text files**: Binary files are read as base64 or object URLs; text files are read as strings. The `processFile` callback in `page.tsx` handles this branching
- **Shiki code highlighting**: Lazy-loaded via main entry — only used languages/themes are code-split. Config in `src/components/file-preview/shiki.ts`
- **State management**: React state/hooks only — no global state library

### CSS & Styling (file-preview)

The `file-preview/` module is **framework-agnostic and has zero external UI dependencies**:

- **No Tailwind** in preview components — uses `fv-` prefixed BEM-style CSS classes
- **No lucide-react** — uses inline SVG icons from `icons.tsx`
- **No shadcn/ui** — uses `.fv-btn`, `.fv-spinner`, `.fv-badge` etc. defined in `styles/base.css`
- **No @tailwindcss/typography** — uses `.fv-prose` class with self-contained typography styles (headings, paragraphs, lists, tables, blockquotes, code, links, images, etc.)
- **Dark mode**: `[data-fv-theme="dark"]` selector on root element
- **Theming**: Override CSS variables (`--fv-primary`, `--fv-muted`, `--fv-border`, etc.) to customize appearance
- **Import**: `import './styles/index.css'` or individual `import './styles/PdfPreview.css'`
- **Asset base path**: `core/config.ts` provides `setAssetBasePath()` / `resolveAssetPath()` for static assets (PDF.js worker, RTF.js bundles, demo files). Replaces `process.env.NEXT_PUBLIC_BASE_PATH`.
- **i18n**: `core/i18n.ts` provides `LocaleMessages` type + `zhCN`/`enUS` locales + `LocaleProvider` context + `useLocale()` hook. All UI strings are externalized — zero hardcoded Chinese/English in components. Consumers can override locale via `<LocaleProvider value={enUS}>`.

The app layer (`page.tsx`, layout) still uses Tailwind + shadcn/ui — only the file-preview module is decoupled.

### shadcn/ui

Components are installed via the "new-york" style variant at `@/components/ui/`. Path aliases use `@/*` → `./src/*`. Add new components with:

```bash
npx shadcn@latest add <component>
```

## Deployment

The app builds to a standalone output (`.next/standalone/`) for Docker/Node deployment. The `build` script handles copying static assets. Caddy is configured as a reverse proxy on port 81 (see `Caddyfile`).
