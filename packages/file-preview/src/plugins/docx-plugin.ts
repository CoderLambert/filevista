import { loadWithOptionalDep, type PreviewPlugin } from "../core/plugin";

export const docxPlugin: PreviewPlugin = {
  id: "builtin.docx",
  name: "DOCX Preview",
  priority: 100,
  match: (file) => file.fileType === "docx",
  load: loadWithOptionalDep(
    () => import("../preview-adapters/DocxPreviewAdapter"),
    { package: "docx-preview", featureLabel: "DOCX preview" },
  ),
};
