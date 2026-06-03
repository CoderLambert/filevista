import { CsvPreview } from "../CsvPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function CsvPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <CsvPreview content={file.content} fileName={file.name} />;
}