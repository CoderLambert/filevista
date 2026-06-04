"use client";

import type { FileInfo } from "../utils";
import { useSourceBase64 } from "../hooks/useSourceBase64";
import { ZipPreview } from "../ZipPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function ZipPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceBase64(file.source);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading ZIP...</div>;
  }

  if (error || !content) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to read ZIP"
        description={error?.message ?? "Unable to read ZIP source."}
      />
    );
  }

  return <ZipPreview content={content} fileName={file.name} />;
}
