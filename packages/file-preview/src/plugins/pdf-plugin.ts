import type { PreviewPlugin } from "../core/plugin";

export const pdfPlugin: PreviewPlugin = {
  id: "builtin.pdf",
  name: "PDF Preview",
  priority: 100,
  match: (file) => file.fileType === "pdf",
  load: () => import("../preview-adapters/PdfPreviewAdapter"),
};
