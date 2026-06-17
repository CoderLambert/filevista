import type { PreviewPlugin } from "../core/plugin";

export const textPlugin: PreviewPlugin = {
  id: "builtin.text",
  name: "Text Preview",
  priority: 100,
  match: (file) => file.fileType === "text",
  load: () => import("../preview-adapters/TextPreviewAdapter"),
};
