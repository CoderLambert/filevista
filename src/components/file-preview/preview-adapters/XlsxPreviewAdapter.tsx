import { XlsxPreview } from "../XlsxPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function XlsxPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.source && !file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <XlsxPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
      fileSize={file.size}
    />
  );
}
