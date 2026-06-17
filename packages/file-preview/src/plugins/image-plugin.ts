import type { PreviewPlugin } from "../core/plugin";

export const imagePlugin: PreviewPlugin = {
  id: "builtin.image",
  name: "Image Preview",
  priority: 100,
  match: (file) => file.fileType === "image",
  load: () => import("../preview-adapters/ImagePreviewAdapter"),
};
