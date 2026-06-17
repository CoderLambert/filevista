import { loadWithOptionalDep, type PreviewPlugin } from "../core/plugin";

export const zipPlugin: PreviewPlugin = {
  id: "builtin.zip",
  name: "ZIP Preview",
  priority: 100,
  match: (file) => file.fileType === "zip",
  load: loadWithOptionalDep(
    () => import("../preview-adapters/ZipPreviewAdapter"),
    { package: "jszip", featureLabel: "ZIP preview" },
  ),
};
