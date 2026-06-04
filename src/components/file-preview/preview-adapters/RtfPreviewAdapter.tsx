"use client";

import type { FileInfo } from "../utils";
import { useSourceText } from "../hooks/useSourceText";
import { RtfPreview } from "../RtfPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function RtfPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceText(file.source);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  if (error || content === null) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to read file"
        description={error?.message ?? "Unable to read file source."}
      />
    );
  }

  return <RtfPreview content={content} fileName={file.name} />;
}
