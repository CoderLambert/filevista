import { loadWithOptionalDep, type PreviewPlugin } from "../core/plugin";

export const pdfPlugin: PreviewPlugin = {
  id: "builtin.pdf",
  name: "PDF Preview",
  priority: 100,
  match: (file) => file.fileType === "pdf",
  load: loadWithOptionalDep(
    () => import("../preview-adapters/PdfPreviewAdapter"),
    { package: "pdfjs-dist", featureLabel: "PDF preview" },
  ),
};
