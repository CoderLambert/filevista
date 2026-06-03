import { HtmlPreview } from "../HtmlPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function HtmlPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <HtmlPreview content={file.content} fileName={file.name} />;
}