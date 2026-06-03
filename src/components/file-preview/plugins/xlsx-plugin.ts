import type { PreviewPlugin } from "../core/plugin";

export const xlsxPlugin: PreviewPlugin = {
  id: "builtin.xlsx",
  name: "XLSX Preview",
  priority: 100,
  match: (file) => file.fileType === "xlsx",
  load: () => import("../preview-adapters/XlsxPreviewAdapter"),
};
