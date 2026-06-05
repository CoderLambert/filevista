"use client";

import type { FileInfo } from "../utils";
import { useSourceText } from "../hooks/useSourceText";
import { MarkdownPreview } from "../MarkdownPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function MarkdownPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceText(file.source);

  if (loading) {
    return <PreviewLoading label="Loading markdown..." />;
  }

  if (error || content === null) {
    return (
      <PreviewFallback
        kind="source-read-failed"
        file={file}
        error={error}
        title="Failed to read file"
        description={error?.message ?? "Unable to read file source."}
      />
    );
  }

  return <MarkdownPreview content={content} />;
}
