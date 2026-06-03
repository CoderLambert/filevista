import { SvgPreview } from "../SvgPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function SvgPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <SvgPreview content={file.content} fileName={file.name} />;
}