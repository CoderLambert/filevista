"use client";

import type { FileInfo } from "../utils";
import { useSourceBase64 } from "../hooks/useSourceBase64";
import { EpubPreview } from "../EpubPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function EpubPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceBase64(file.source);

  if (loading) {
    return <PreviewLoading label="Loading EPUB..." />;
  }

  if (error || !content) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to read EPUB"
        description={error?.message ?? "Unable to read EPUB source."}
      />
    );
  }

  return <EpubPreview content={content} fileName={file.name} />;
}
