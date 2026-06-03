# FileVista Plugin Development Guide

This document describes how to add a new file type Preview Plugin to FileVista.

## 1. Add FileType

Update:

```txt
src/components/file-preview/utils.ts
```

Sync the following:

```txt
ALL_FILE_TYPES
FileType
detectFileType()
getFileTypeLabel()
getFileTypeColor()
```

## 2. Add File Type Detection Logic

Add extension or MIME check in `detectFileType()`.

Principles:

```txt
1. Prefer extension-based detection
2. Use MIME only as a secondary signal
3. Never let legacy binary formats match modern formats
```

Incorrect examples:

```txt
.doc should NOT match docx
.ppt should NOT match pptx
.xls should NOT match xlsx
```

## 3. Create Plugin

Create:

```txt
src/components/file-preview/plugins/<type>-plugin.ts
```

Example:

```ts
import type { PreviewPlugin } from "../core/plugin";

export const examplePlugin: PreviewPlugin = {
  id: "builtin.example",
  name: "Example Preview",
  priority: 100,
  match: (file) => file.fileType === "example",
  load: () => import("../preview-adapters/ExamplePreviewAdapter"),
};
```

## 4. Create Adapter

Create:

```txt
src/components/file-preview/preview-adapters/ExamplePreviewAdapter.tsx
```

Adapter rules:

```txt
1. Only bridge FileInfo to existing Preview component props
2. Do not re-parse files inside the adapter
3. Do not import heavy parsing libraries directly
4. Return UnsupportedPluginPreview when input is missing
5. Do not modify file.content / file.source / file.url
```

## 5. Register Plugin

Update:

```txt
src/components/file-preview/plugins/builtin-plugins.ts
```

Add to:

```ts
builtinPreviewPlugins
```

## 6. Update Support Matrix

Update:

```txt
src/components/file-preview/support-status.ts
```

Add:

```ts
example: {
  fileType: "example",
  status: "plugin-supported",
  legacyRenderer: "unsupported",
  pluginRenderer: "supported",
  pluginId: "builtin.example",
}
```

## 7. Update Tests

Run:

```bash
bun run test:run
```

If failing, check:

```txt
plugin id
plugin match
builtin registration
support-status pluginId
```

## 8. Update Docs

Sync updates to:

```txt
README.md
docs/user-facing-preview-support.md
docs/preview-plugin-validation-matrix.md
```

## 9. Final Verification

```bash
bun run check
bun run build:pages
```
