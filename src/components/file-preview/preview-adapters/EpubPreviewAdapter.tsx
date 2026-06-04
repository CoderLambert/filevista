"use client";

import type { FileInfo } from "../utils";
import { useSourceBase64 } from "../hooks/useSourceBase64";
import { EpubPreview } from "../EpubPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function EpubPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceBase64(file.source);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading EPUB...</div>;
  }

  if (error || !content) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to read EPUB"
        description={error?.message ?? "Unable to read EPUB source."}
      />
    );
  }

  return <EpubPreview content={content} fileName={file.name} />;
}
