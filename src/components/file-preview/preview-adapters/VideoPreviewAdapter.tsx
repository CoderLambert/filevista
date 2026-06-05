"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { VideoPreview } from "../VideoPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function VideoPreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <PreviewLoading label="Loading video..." />;
  }

  if (error || !objectUrl) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to load video"
        description={error?.message ?? "Unable to create video preview."}
      />
    );
  }

  return <VideoPreview url={objectUrl} fileName={file.name} />;
}
