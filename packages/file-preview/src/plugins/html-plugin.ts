import type { PreviewPlugin } from "../core/plugin";

export const htmlPlugin: PreviewPlugin = {
  id: "builtin.html",
  name: "HTML Preview",
  priority: 100,
  match: (file) => file.fileType === "html",
  load: () => import("../preview-adapters/HtmlPreviewAdapter"),
};