import type { PreviewPlugin } from "../core/plugin";

export const audioPlugin: PreviewPlugin = {
  id: "builtin.audio",
  name: "Audio Preview",
  priority: 100,
  match: (file) => file.fileType === "audio",
  load: () => import("../preview-adapters/AudioPreviewAdapter"),
};