"use client";

import { PptxPreview } from "../PptxPreview";
import type { FileInfo } from "../utils";
import { PreviewError, type PreviewErrorCode } from "../core/preview-error";

export default function PptxPreviewAdapter({
  file,
  reportError,
}: {
  file: FileInfo;
  reportError?: (error: PreviewError) => void;
}) {
  return (
    <PptxPreview
      source={file.source}
      fileName={file.name}
      onError={(error) => {
        if (!reportError) return;
        const code: PreviewErrorCode =
          error instanceof DOMException && error.name === "AbortError"
            ? "ABORTED"
            : "RENDER_FAILED";
        reportError(
          new PreviewError(code, error.message || "PPTX preview failed", {
            cause: error,
            pluginId: "builtin.pptx",
            pluginName: "PPTX Preview",
            fileName: file.name,
          }),
        );
      }}
    />
  );
}