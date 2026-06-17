import type { PreviewPlugin } from "@lamberl-lee/file-preview";

export const nutrientPptxPlugin: PreviewPlugin = {
  id: "playground.nutrient-pptx",
  name: "Nutrient PPTX Preview",
  priority: 200,
  match: (file) => file.fileType === "pptx",
  load: () => import("../preview-adapters/NutrientPptxPreviewAdapter"),
};
