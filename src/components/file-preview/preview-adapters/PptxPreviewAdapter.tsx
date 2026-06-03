import { PptxPreview } from "../PptxPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function PptxPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.source && !file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <PptxPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
    />
  );
}
