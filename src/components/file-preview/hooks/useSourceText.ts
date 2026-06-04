"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsText } from "../core/source";

export interface SourceTextState {
  content: string | null;
  loading: boolean;
  error: Error | null;
}

export function useSourceText(source: PreviewSource): SourceTextState {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setContent(null);

    readSourceAsText(source)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
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
