import { PptxPreview } from "../PptxPreview";
import type { FileInfo } from "../utils";

export default function PptxPreviewAdapter({ file }: { file: FileInfo }) {
  return (
    <PptxPreview
      content={undefined}
      source={file.source}
      fileName={file.name}
    />
  );
}
