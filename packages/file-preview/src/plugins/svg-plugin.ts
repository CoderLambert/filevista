import type { PreviewPlugin } from "../core/plugin";

export const svgPlugin: PreviewPlugin = {
  id: "builtin.svg",
  name: "SVG Preview",
  priority: 100,
  match: (file) => file.fileType === "svg",
  load: () => import("../preview-adapters/SvgPreviewAdapter"),
};