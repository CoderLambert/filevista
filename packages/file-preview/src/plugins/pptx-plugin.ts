import { loadWithOptionalDep, type PreviewPlugin } from "../core/plugin";

export const pptxPlugin: PreviewPlugin = {
  id: "builtin.pptx",
  name: "PPTX Preview",
  priority: 100,
  match: (file) => file.fileType === "pptx",
  load: loadWithOptionalDep(
    async () => {
      await import("@aiden0z/pptx-renderer");
      return import("../preview-adapters/PptxPreviewAdapter");
    },
    { package: "@aiden0z/pptx-renderer", featureLabel: "PPTX preview" },
  ),
};
