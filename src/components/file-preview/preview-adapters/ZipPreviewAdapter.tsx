"use client";

import type { FileInfo } from "../utils";
import { useSourceBase64 } from "../hooks/useSourceBase64";
import { ZipPreview } from "../ZipPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function ZipPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceBase64(file.source);

  if (loading) {
    return <PreviewLoading label="Loading ZIP..." />;
  }

  if (error || !content) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to read ZIP"
        description={error?.message ?? "Unable to read ZIP source."}
      />
    );
  }

  return <ZipPreview content={content} fileName={file.name} />;
}
