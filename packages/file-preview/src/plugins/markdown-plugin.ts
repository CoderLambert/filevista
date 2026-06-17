import type { PreviewPlugin } from "../core/plugin";

export const markdownPlugin: PreviewPlugin = {
  id: "builtin.markdown",
  name: "Markdown Preview",
  priority: 100,
  match: (file) => file.fileType === "markdown",
  load: () => import("../preview-adapters/MarkdownPreviewAdapter"),
};