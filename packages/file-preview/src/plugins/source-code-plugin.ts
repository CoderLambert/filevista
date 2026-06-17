import type { PreviewPlugin } from "../core/plugin";

export const sourceCodePlugin: PreviewPlugin = {
  id: "builtin.source-code",
  name: "Source Code Preview",
  priority: 100,
  match: (file) => file.fileType === "code" || file.fileType === "json",
  load: () => import("../preview-adapters/SourceCodePreviewAdapter"),
};
