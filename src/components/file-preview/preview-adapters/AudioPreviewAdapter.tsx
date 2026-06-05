"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { AudioPreview } from "../AudioPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function AudioPreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <PreviewLoading label="Loading audio..." />;
  }

  if (error || !objectUrl) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to load audio"
        description={error?.message ?? "Unable to create audio preview."}
      />
    );
  }

  return <AudioPreview url={objectUrl} fileName={file.name} />;
}
