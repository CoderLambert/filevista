"use client";

import { useEffect, useState } from "react";
import type { FileInfo } from "../utils";
import { readSourceAsArrayBuffer } from "../core/source";
import { RtfPreview } from "../RtfPreview";
import { PreviewFallback } from "../PreviewFallback";
import { PreviewLoading } from "../PreviewLoading";

export default function RtfPreviewAdapter({ file }: { file: FileInfo }) {
  const [rawText, setRawText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setRawText(null);

    // RTF is a 7-bit ASCII text format (Unicode escapes are encoded as
    // \uNNNN). Decoding via TextDecoder preserves the original bytes
    // losslessly while giving us the string the parser needs.
    readSourceAsTextSafe(file.source)
      .then((text) => {
        if (!cancelled) {
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

  if (error || rawText === null) {
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

  return <RtfPreview rawText={rawText} fileName={file.name} />;
}

/**
 * Read source as text via TextDecoder on the underlying ArrayBuffer.
 * RTF files are ASCII (with `\uNNNN` for non-ASCII), so utf-8 decoding
 * with `fatal: false` is the right strategy.
 */
async function readSourceAsTextSafe(source: NonNullable<FileInfo["source"]>): Promise<string> {
  const buffer = await readSourceAsArrayBuffer(source);
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}
