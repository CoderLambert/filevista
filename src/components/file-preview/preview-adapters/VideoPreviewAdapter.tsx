import { VideoPreview } from "../VideoPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function VideoPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.url) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <VideoPreview url={file.url} fileName={file.name} />;
}