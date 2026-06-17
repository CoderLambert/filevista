import type { PreviewPlugin } from "../core/plugin";

export const epubPlugin: PreviewPlugin = {
  id: "builtin.epub",
  name: "EPUB Preview",
  priority: 100,
  match: (file) => file.fileType === "epub",
  load: () => import("../preview-adapters/EpubPreviewAdapter"),
};
