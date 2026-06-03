import { EpubPreview } from "../EpubPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function EpubPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <EpubPreview content={file.content} fileName={file.name} />;
}
