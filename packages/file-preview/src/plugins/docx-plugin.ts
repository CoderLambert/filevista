import type { PreviewPlugin } from "../core/plugin";

export const docxPlugin: PreviewPlugin = {
  id: "builtin.docx",
  name: "DOCX Preview",
  priority: 100,
  match: (file) => file.fileType === "docx",
  load: () => import("../preview-adapters/DocxPreviewAdapter"),
};
