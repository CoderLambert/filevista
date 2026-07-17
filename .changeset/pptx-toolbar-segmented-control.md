---
"@lamberl-lee/file-preview": minor
---

Redesign PPTX toolbar with segmented view-mode control

Replace the icon-only view-mode toggle with a labeled segmented control centered in the toolbar. Slide navigation moves to the left next to the page counter and stays hidden in grid view to reduce visual clutter.

- New `LayoutGridIcon` replaces `Grid3X3Icon` for the grid view button
- Added `previewMode` / `slideViewShort` / `gridViewShort` / `slideViewHint` / `gridViewHint` locale entries; renamed `slideView` / `gridView` labels to "Single Page" / "Thumbnails"
- Added `data-active` / `aria-pressed` attributes for accessible state
- Added responsive short labels at <=760px and icon-only layout at <=420px
- Toolbar styling aligned with `fv-html__fit-btn` / `fv-html__source-group` (Slate palette, dark mode variants)
- Lifecycle test now selects the grid toggle by `data-active='false'` instead of the localized title
