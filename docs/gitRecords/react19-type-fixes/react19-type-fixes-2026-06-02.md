# Git Change Analysis: React 19 Type Fixes & Preview Plugin Registry

**Generated**: 2026-06-02  
**Branch**: refactor/preview-plugin-registry  
**Commit Hash**: pending

## Overview

This commit addresses two distinct but related concerns:

1. **React 19 strict type compatibility** — Fixes TypeScript compilation errors caused by React 19's stricter type definitions for `ReactElement.props`, `Slot` component refs, and `ArrayBuffer`/`Uint8Array` interoperability across multiple file preview components.

2. **Preview plugin registry scaffolding** — Introduces a new plugin-based architecture for the file preview system, replacing the hardcoded tab-based switching in `FilePreviewRenderer.tsx` with a composable `PreviewPlugin` system. This is a foundational refactor that enables third-party preview plugins and cleaner separation of concerns.

Supporting changes include dead code removal (`code-languages.ts` for uninstalled highlight.js), build configuration updates (`tsconfig.json` exclude, `global.d.ts` for CSS modules), and Shiki import cleanup.

## Branch Information

- **Current Branch**: `refactor/preview-plugin-registry`
- **Tracking**: `origin/refactor/preview-plugin-registry` (up to date)
- **Base Branch**: `main`

## Changed Files

| File Path | Change Type | Lines +/- | Description |
|-----------|-------------|-----------|-------------|
| `src/components/file-preview/DocPreview.tsx` | Modified | +2/-2 | ArrayBuffer/BlobPart type casts for React 19 compatibility |
| `src/components/file-preview/EpubPreview.tsx` | Modified | +1/-1 | ArrayBuffer type cast for JSZip |
| `src/components/file-preview/MarkdownPreview.tsx` | Modified | +3/-3 | `node.props` typed as `any` for React 19 strict types |
| `src/components/file-preview/PdfPreview.tsx` | Modified | +1/-1 | BlobPart type cast for React 19 compatibility |
| `src/components/file-preview/PptxPreview.tsx` | Modified | +1/-1 | ArrayBuffer type cast for Pptx viewer |
| `src/components/file-preview/XlsxPreview.tsx` | Modified | +1/-1 | `bytes` typed as `any` for ExcelJS load |
| `src/components/file-preview/ZipPreview.tsx` | Modified | +2/-2 | ArrayBuffer type cast + `_data` property access simplification |
| `src/components/file-preview/code-languages.ts` | **Deleted** | +0/-137 | Removed unused highlight.js language registry |
| `src/components/ui/badge.tsx` | Modified | +1/-1 | Slot ref type cast for React 19 |
| `src/components/ui/breadcrumb.tsx` | Modified | +1/-1 | Slot ref type cast for React 19 |
| `src/components/ui/button.tsx` | Modified | +1/-1 | Slot ref type cast for React 19 |
| `src/components/ui/sidebar.tsx` | Modified | +5/-5 | Slot ref type casts (5 components) for React 19 |
| `src/lib/shiki.ts` | Modified | +1/-1 | Removed unused `CodeToHtmlOptions` import |
| `tsconfig.json` | Modified | +2/-1 | Added `examples/` to exclude list |
| `src/components/file-preview/registry/types.ts` | **New** | +54 | Plugin interface definitions (`PreviewPlugin`, `PreviewPluginContext`, `PreviewPluginRegistry`) |
| `src/components/file-preview/registry/preview-registry.ts` | **New** | +68 | Default plugin registry implementation with `resolve()` logic |
| `src/components/file-preview/registry/builtin-preview-plugins.tsx` | **New** | +217 | All existing preview components wrapped as lazy-loaded plugins |
| `src/components/file-preview/registry/index.ts` | **New** | +12 | Barrel export for registry module |
| `src/global.d.ts` | **New** | +4 | CSS module type declaration (`*.css` → `Record<string, string>`) |

## Implementation Checklist

### React 19 Type Compatibility Fixes

- [x] ArrayBufferLike casts: `bytes.buffer as ArrayBuffer` in DocPreview, EpubPreview, PdfPreview, PptxPreview, ZipPreview
- [x] BlobPart assertions: `bytes as unknown as BlobPart` in DocPreview, PdfPreview
- [x] ReactElement.props assertions: `(node.props as any).children` in MarkdownPreview (3 occurrences)
- [x] ExcelJS compatibility: `bytes as any` in XlsxPreview
- [x] Slot ref type casts: `Slot as React.ComponentType<any>` in badge, breadcrumb, button, sidebar (5 components)
- [x] Unused import removal: `CodeToHtmlOptions` in shiki.ts

### Preview Plugin Registry

- [x] `PreviewPlugin` interface with id, name, fileTypes, priority, canPreview(), render()
- [x] `PreviewPluginContext` interface passing file metadata to plugins
- [x] `PreviewPluginRegistry` interface (register, registerMany, resolve, getPlugins)
- [x] `DefaultPreviewPluginRegistry` class with plugin deduplication and priority-based resolution
- [x] `createPreviewPluginRegistry()` factory function
- [x] All 18 builtin preview components wrapped as lazy-loaded plugins
- [x] Barrel exports via `registry/index.ts`

### Build & Configuration

- [x] `code-languages.ts` deleted (highlight.js not installed)
- [x] `examples/` added to tsconfig exclude
- [x] `global.d.ts` added for CSS module type declarations

## Change Statistics

- **Total Files Changed**: 19 (14 modified/deleted tracked + 5 new untracked)
- **Lines Added**: ~377
- **Lines Removed**: ~158
- **Net Change**: +219 lines
- **Files by Type**:
  - Preview Components: 7 modified, 1 deleted
  - UI Components (shadcn): 4 modified
  - New Registry Module: 4 new files
  - Configuration: 2 modified (tsconfig, shiki.ts)
  - Type Declarations: 1 new (global.d.ts)

## Technical Highlights

### Key Technical Decisions

1. **`as any` for ReactElement.props**: React 19 removed the implicit `any` type on `ReactElement.props`. Rather than creating custom type guards, `(node.props as any)` is used for the minimal surface area where `children` is accessed dynamically. This is the least invasive fix that preserves existing logic.

2. **`as ArrayBuffer` vs `as unknown as BlobPart`**: `Uint8Array.buffer` returns `ArrayBufferLike` (which includes `SharedArrayBuffer`), but APIs like `JSZip.loadAsync()` and `Blob` constructor expect `ArrayBuffer` or `BlobPart`. The cast to `ArrayBuffer` is safe because these `Uint8Array` instances are always created from local file reads (never SharedArrayBuffer). The `BlobPart` assertion via `unknown` is needed because `Uint8Array` is not directly assignable to `BlobPart` in strict TypeScript, but the `Blob` constructor accepts it at runtime.

3. **Plugin architecture over hardcoded tabs**: The new registry replaces the `FilePreviewRenderer.tsx` pattern of mounting all preview components simultaneously (CSS display toggling) with a `resolve()` method that selects the highest-priority matching plugin. This reduces initial render cost and enables third-party plugin registration.

4. **Lazy loading preserved**: Each builtin plugin uses `React.lazy()` to wrap its component import, maintaining the existing code-splitting behavior.

### Patterns Used

- **Plugin Pattern**: `PreviewPlugin` interface with stable `id`, declarative `fileTypes` matching, and optional `canPreview()` fine-grained matcher
- **Priority-based Resolution**: `resolve()` filters by fileTypes, applies canPreview, sorts by priority (highest wins), returns first match
- **Factory Function**: `createPreviewPluginRegistry(plugins?)` for convenient one-line setup
- **Deduplication**: `register()` throws if plugin id already registered
- **Lazy Component Loading**: `React.lazy()` with dynamic import for each builtin preview component

### Dependencies

- No new runtime dependencies added
- Removed implicit dependency on `highlight.js` (was never installed, code was dead)

## Feature Flow Diagram

```
FileInfo (detectFileType)
    |
    v
┌─────────────────────────────────────────┐
│  PreviewPluginRegistry                  │
│  ┌───────────────────────────────────┐  │
│  │ resolve(file)                     │  │
│  │   1. createContext(file)          │  │
│  │   2. Filter: plugin.fileTypes     │  │
│  │      includes(fileType)           │  │
│  │   3. Filter: plugin.canPreview?() │  │
│  │   4. Sort: priority desc          │  │
│  │   5. Return plugins[0] or null    │  │
│  └───────────────────────────────────┘  │
└────────────┬────────────────────────────┘
             |
             | PreviewPlugin
             v
┌─────────────────────────┐
│  plugin.render(context) │
│   (lazy React.lazy())   │
│                         │
│  <PdfPreview />         │
│  <MarkdownPreview />    │
│  <CodePreview />        │
│  ... (18 total)         │
└─────────────────────────┘
```

## Follow-up Plans

### Immediate Next Steps

- [ ] Integrate registry into `FilePreviewRenderer.tsx` — replace TabCacheRenderer with plugin-based rendering
- [ ] Update `page.tsx` to use `createPreviewPluginRegistry(builtinPreviewPlugins)`
- [ ] Add TypeScript compilation check to CI to catch type regressions early

### Future Improvements

- [ ] Support plugin overrides (third-party plugin with same id as builtin)
- [ ] Add plugin discovery mechanism (auto-load from a plugins/ directory)
- [ ] Consider memoizing `resolve()` results for performance with many plugins
- [ ] Add plugin lifecycle hooks (onMount, onUnmount) if needed for cleanup (e.g., revoking object URLs)

### Known Issues

- None identified. All type casts are safe given the data flow (local file reads produce ArrayBuffer, not SharedArrayBuffer).

## Related Documentation

- `/docs/gitRecords/` — Git change analysis directory
- `CLAUDE.md` — Project architecture documentation
- React 19 type changes: https://react.dev/blog/2024/12/05/react-19

## Important Notes

### Breaking Changes

- **`code-languages.ts` deleted**: Any external code referencing this module will fail. This file was for highlight.js which was never installed, so no runtime impact.
- **Slot type casts**: The `Slot as React.ComponentType<any>` pattern bypasses type safety for ref forwarding. If Radix UI updates Slot types in the future, these casts should be revisited.

### Migration Required

- No data migration needed. These are compile-time type fixes only.
- When integrating the registry into the renderer, the tab-based switching logic in `FilePreviewRenderer.tsx` will need to be replaced.

### Special Considerations

- **`as any` usage**: MarkdownPreview uses `(node.props as any).children` in 3 places. This is a pragmatic workaround for React 19's stricter `ReactElement` types. A more robust solution would involve a recursive type guard or switching to a different AST traversal approach, but that is out of scope for this fix.
- **XlsxPreview `bytes as any`**: ExcelJS's `workbook.xlsx.load()` has complex overloaded signatures. The `as any` cast avoids fighting the type system for a case where the runtime behavior is known to be correct.

### Testing Notes

- Manual testing recommended for each preview type after registry integration
- Verify that lazy-loaded components still render correctly within the Suspense boundary
- Test plugin priority resolution by registering a custom plugin with higher priority than a builtin

## Code Review Notes

- The Slot ref type casts in UI components follow a consistent pattern across 5 files. Consider extracting this into a shared utility if more components need the same fix.
- The preview registry's `canPreview()` matcher is defined but not used by any builtin plugins. It is reserved for future use cases like MIME-type-based disambiguation.
- `pnpm-lock.yaml` is untracked — this may be intentional (using bun instead). Verify before committing.
- The `fileName` prop in builtin-preview-plugins is passed to preview components, but several of those components may not actually use it. This could be cleaned up in a follow-up if desired.
