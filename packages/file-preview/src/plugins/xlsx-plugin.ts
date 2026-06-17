import { loadWithOptionalDep, type PreviewPlugin } from "../core/plugin";

export const xlsxPlugin: PreviewPlugin = {
  id: "builtin.xlsx",
  name: "XLSX Preview",
  priority: 100,
  match: (file) => file.fileType === "xlsx",
  load: loadWithOptionalDep(
    () => import("../preview-adapters/XlsxPreviewAdapter"),
    { package: "exceljs", featureLabel: "XLSX preview" },
  ),
};
