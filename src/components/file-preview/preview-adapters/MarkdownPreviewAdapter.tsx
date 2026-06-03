import { MarkdownPreview } from "../MarkdownPreview";
import type { FileInfo } from "../utils";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function MarkdownPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file.content) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return <MarkdownPreview content={file.content} />;
}