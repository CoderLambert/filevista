import { XlsxPreview } from "../XlsxPreview";
import type { FileInfo } from "../utils";

export default function XlsxPreviewAdapter({ file }: { file: FileInfo }) {
  return (
    <XlsxPreview
      content={undefined}
      source={file.source}
      fileName={file.name}
      fileSize={file.size}
    />
  );
}
