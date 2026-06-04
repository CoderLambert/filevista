import { XlsxPreview } from "../XlsxPreview";
import type { FileInfo } from "../utils";

export default function XlsxPreviewAdapter({ file }: { file: FileInfo }) {
  return (
    <XlsxPreview
      content={file.content}
      source={file.source}
      fileName={file.name}
      fileSize={file.size}
    />
  );
}
