"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { ImagePreview } from "../ImagePreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function ImagePreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <PreviewLoading label="Loading image..." />;
  }

  if (error || !objectUrl) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to load image"
        description={error?.message ?? "Unable to create image preview."}
      />
    );
  }

  return <ImagePreview url={objectUrl} fileName={file.name} />;
}
