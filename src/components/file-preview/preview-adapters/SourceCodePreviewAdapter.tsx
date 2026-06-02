import { CodePreview } from "../CodePreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function SourceCodePreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <CodePreview
      content={file.content}
      fileName={file.name}
      isJson={file.fileType === "json"}
    />
  );
}
