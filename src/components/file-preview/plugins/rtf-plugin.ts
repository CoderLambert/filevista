import type { PreviewPlugin } from "../core/plugin";

export const rtfPlugin: PreviewPlugin = {
  id: "builtin.rtf",
  name: "RTF Preview",
  priority: 100,
  match: (file) => file.fileType === "rtf",
  load: () => import("../preview-adapters/RtfPreviewAdapter"),
};
