import { DocxPreview } from "../DocxPreview";
import type { FileInfo } from "../utils";

export default function DocxPreviewAdapter({ file }: { file: FileInfo }) {
  return (
    <DocxPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
    />
  );
}
