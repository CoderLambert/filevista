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

    // rtf.js needs the original bytes (ArrayBuffer); the source view and
    // the text-extraction fallback both want a string. Decode once via
    // TextDecoder so both code paths see the same content.
    readSourceAsArrayBuffer(file.source)
      .then((buf) => {
        if (cancelled) return;
        const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        setBuffer(buf);
        setRawText(text);
        setLoading(false);
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

  return <RtfPreview buffer={buffer} rawText={rawText} fileName={file.name} />;
}
