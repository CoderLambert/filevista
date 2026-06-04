"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { ImagePreview } from "../ImagePreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function ImagePreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading image...</div>;
  }

  if (error || !objectUrl) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to load image"
        description={error?.message ?? "Unable to create image preview."}
      />
    );
  }

  return <ImagePreview url={objectUrl} fileName={file.name} />;
}
