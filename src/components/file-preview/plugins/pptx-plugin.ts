import type { PreviewPlugin } from "../core/plugin";

export const pptxPlugin: PreviewPlugin = {
  id: "builtin.pptx",
  name: "PPTX Preview",
  priority: 100,
  match: (file) => file.fileType === "pptx",
  load: () => import("../preview-adapters/PptxPreviewAdapter"),
};
