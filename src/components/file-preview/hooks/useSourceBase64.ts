"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsBase64 } from "../core/source";

export interface SourceBase64State {
  content: string | null;
  loading: boolean;
  error: Error | null;
}

export function useSourceBase64(source: PreviewSource): SourceBase64State {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setContent(null);

    readSourceAsBase64(source)
      .then((base64) => {
        if (!cancelled) {
          setContent(base64);
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
  }, [source]);

  return { content, loading, error };
}
