import { ImagePreview } from "../ImagePreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function ImagePreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.url) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <ImagePreview url={file.url} fileName={file.name} />;
}
