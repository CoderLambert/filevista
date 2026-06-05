"use client";

import { useEffect, useState } from "react";
import type { FileInfo } from "../utils";
import { readSourceAsArrayBuffer } from "../core/source";
import { RtfPreview } from "../RtfPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function RtfPreviewAdapter({ file }: { file: FileInfo }) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setBuffer(null);
    setRawText(null);

    // Read source as ArrayBuffer (preserves original bytes)
    // and also as string (for source view + text-extraction fallback)
    Promise.all([
      readSourceAsArrayBuffer(file.source),
      readSourceAsTextSafe(file.source),
    ])
      .then(([buf, text]) => {
        if (!cancelled) {
          setBuffer(buf);
          setRawText(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.source]);

  if (loading) {
    return <PreviewLoading label="Loading RTF..." />;
  }

  if (error || buffer === null || rawText === null) {
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

  return (
    <RtfPreview
      buffer={buffer}
      rawText={rawText}
      fileName={file.name}
    />
  );
}

/**
 * Read source as text with a fallback.
 * Unlike the standard `readSourceAsText`, this uses the ArrayBuffer
 * path to decode with TextDecoder, which preserves the original bytes.
 */
async function readSourceAsTextSafe(source: NonNullable<FileInfo["source"]>): Promise<string> {
  const buffer = await readSourceAsArrayBuffer(source);
  // Use TextDecoder with 'utf-8' and 'fatal: false' for robust decoding
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}
