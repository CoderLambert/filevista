"use client";

import { useEffect, useRef, useState } from "react";
import { readSourceAsArrayBuffer, type FileInfo } from "@lamberl-lee/file-preview";

type NutrientViewerModule = {
  load(config: {
    container: HTMLElement | string;
    document: ArrayBuffer;
    licenseKey?: string;
    useCDN?: boolean;
    baseUrl?: string;
  }): Promise<unknown>;
  unload(target: HTMLElement | string | null): boolean;
};

const NUTRIENT_LICENSE_KEY =
  process.env.NEXT_PUBLIC_NUTRIENT_LICENSE_KEY?.trim() || undefined;

// Respect the basePath config for GitHub Pages deployment
const NUTRIENT_BASE_URL = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/vendor/nutrient/`;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load the document with Nutrient Web SDK.";
}

export default function NutrientPptxPreviewAdapter({ file }: { file: FileInfo }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let viewer: NutrientViewerModule | null = null;

    const loadPreview = async () => {
      try {
        setStatus("loading");
        setErrorMessage(null);

        const buffer = await readSourceAsArrayBuffer(file.source);
        if (cancelled) return;

        const mod = await import("@nutrient-sdk/viewer");
        viewer = (mod.default ?? mod) as unknown as NutrientViewerModule;

        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = "";

        await viewer.load({
          container,
          document: buffer,
          licenseKey: NUTRIENT_LICENSE_KEY,
          // Nutrient requires an absolute URL for baseUrl
          baseUrl: `${window.location.origin}${NUTRIENT_BASE_URL}`,
        });

        if (cancelled) {
          viewer.unload(container);
          return;
        }

        setStatus("ready");
      } catch (error) {
        if (cancelled) return;

        setErrorMessage(getErrorMessage(error));
        setStatus("error");
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;

      const container = containerRef.current;
      if (viewer && container) {
        viewer.unload(container);
      }
    };
  }, [file.id, file.source]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {!NUTRIENT_LICENSE_KEY && (
        <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Nutrient is running in trial mode. A watermark is expected until
          `NEXT_PUBLIC_NUTRIENT_LICENSE_KEY` is provided.
        </div>
      )}

      {status === "loading" && (
        <div className="flex min-h-[320px] items-center justify-center border-b bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            <span>Loading PPTX with Nutrient Web SDK…</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Nutrient PPTX preview failed</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-destructive/90">
            {errorMessage}
          </p>
        </div>
      )}

      <div
        ref={containerRef}
        className={status === "ready" ? "min-h-0 flex-1" : "hidden"}
      />
    </div>
  );
}
