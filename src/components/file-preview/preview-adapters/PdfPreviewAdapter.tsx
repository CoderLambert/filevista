import { PdfPreview } from "../PdfPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function PdfPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.source && !file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <PdfPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
    />
  );
}
