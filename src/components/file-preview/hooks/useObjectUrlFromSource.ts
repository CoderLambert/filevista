"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsArrayBuffer } from "../core/source";

export function useObjectUrlFromSource(
  source: PreviewSource,
  mimeType?: string
): {
  objectUrl: string | null;
  loading: boolean;
  error: Error | null;
} {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setObjectUrl(null);

    async function run() {
      try {
        if (source.kind === "file") {
          createdUrl = URL.createObjectURL(source.file);
        } else if (source.kind === "blob") {
          createdUrl = URL.createObjectURL(source.blob);
        } else {
          const buffer = await readSourceAsArrayBuffer(source);
          const blob = new Blob([buffer], {
            type: mimeType || "application/octet-stream",
          });
          createdUrl = URL.createObjectURL(blob);
        }

        if (!cancelled) {
          setObjectUrl(createdUrl);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [source, mimeType]);

  return { objectUrl, loading, error };
}
