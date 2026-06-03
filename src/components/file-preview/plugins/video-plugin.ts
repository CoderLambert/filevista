import type { PreviewPlugin } from "../core/plugin";

export const videoPlugin: PreviewPlugin = {
  id: "builtin.video",
  name: "Video Preview",
  priority: 100,
  match: (file) => file.fileType === "video",
  load: () => import("../preview-adapters/VideoPreviewAdapter"),
};