import { DocxPreview } from "../DocxPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function DocxPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.source && !file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <DocxPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
    />
  );
}
