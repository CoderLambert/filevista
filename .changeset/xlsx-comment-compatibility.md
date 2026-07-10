---
"@lamberl-lee/file-preview": patch
---

### Fixed

- **XLSX comment-part compatibility**: preview workbooks whose legacy comments use absolute relationship targets or nonconventional OOXML part names such as `xl/comments/comment1.xml` and `commentsDrawing1.vml`. When ExcelJS fails to reconcile these optional parts, FileVista now normalizes an in-memory copy and retries without modifying the source file.
- **Plain-text XLSX comments**: preserve comments emitted as `<text><t>...</t></text>` by wrapping them in the rich-text run structure expected by ExcelJS.
