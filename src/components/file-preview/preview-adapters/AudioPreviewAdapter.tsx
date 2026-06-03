import { AudioPreview } from "../AudioPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function AudioPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.url) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <AudioPreview url={file.url} fileName={file.name} />;
}