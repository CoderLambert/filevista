import type { PreviewPlugin } from "../core/plugin";

export const csvPlugin: PreviewPlugin = {
  id: "builtin.csv",
  name: "CSV Preview",
  priority: 100,
  match: (file) => file.fileType === "csv",
  load: () => import("../preview-adapters/CsvPreviewAdapter"),
};