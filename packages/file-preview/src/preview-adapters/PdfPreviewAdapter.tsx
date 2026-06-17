import { PdfPreview } from "../PdfPreview";
import type { FileInfo } from "../utils";

export default function PdfPreviewAdapter({ file }: { file: FileInfo }) {
  return (
    <PdfPreview
      content={undefined}
      source={file.source}
      fileName={file.name}
    />
  );
}
