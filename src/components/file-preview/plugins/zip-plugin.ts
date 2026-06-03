import type { PreviewPlugin } from "../core/plugin";

export const zipPlugin: PreviewPlugin = {
  id: "builtin.zip",
  name: "ZIP Preview",
  priority: 100,
  match: (file) => file.fileType === "zip",
  load: () => import("../preview-adapters/ZipPreviewAdapter"),
};
