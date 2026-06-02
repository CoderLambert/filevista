"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
} from "lucide-react";
import { readBinaryPreviewAsUint8Array } from "./core/binary";
import type { PreviewSource } from "./core/types";

interface PdfPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy?: () => Promise<void>;
}

interface PdfPageLike {
  getViewport(opts: { scale: number; rotation: number }): {
    width: number;
    height: number;
  };
  render(opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): PdfRenderTaskLike;
}

interface PdfRenderTaskLike {
  promise: Promise<void>;
  cancel: () => void;
}

export function PdfPreview({ content, source, fileName }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PdfDocumentLike | null>(null);
  const renderTaskRef = useRef<PdfRenderTaskLike | null>(null);
  const renderingRef = useRef(false);

  const renderPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current) return;

    // Prevent concurrent renders
    if (renderingRef.current) {
      // Cancel the in-progress render
      const prevTask = renderTaskRef.current;
      if (prevTask) {
        try { prevTask.cancel(); } catch { /* ignore */ }
      }
    }

    renderingRef.current = true;

    try {
      const page = await pdfDoc.getPage(currentPage);

      const viewport = page.getViewport({ scale, rotation });
      const displayCanvas = canvasRef.current;
      const context = displayCanvas.getContext("2d");
      if (!context) return;

      // ── Double buffering: render to offscreen canvas first ──
      const offscreen = document.createElement("canvas");
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      const renderTask = page.render({
        canvasContext: offCtx,
        viewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // Only swap to display canvas after render completes
      displayCanvas.width = viewport.width;
      displayCanvas.height = viewport.height;
      context.drawImage(offscreen, 0, 0);

    } catch (err: unknown) {
      // RenderingCancelledException is expected when navigating fast
      const errObj = err as { name?: string };
      if (errObj?.name === "RenderingCancelledException") return;
      console.error("Error rendering PDF page:", err);
    } finally {
      renderingRef.current = false;
      renderTaskRef.current = null;
    }
  }, [currentPage, scale, rotation]);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        // Dynamically import pdfjs-dist to avoid SSR issues
        const pdfjsLib = await import("pdfjs-dist");

        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";

        const bytes = await readBinaryPreviewAsUint8Array({ source, content });

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading PDF:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load PDF"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;

      try {
        renderTaskRef.current?.cancel();
      } catch {
        // ignore
      }

      try {
        void pdfDocRef.current?.destroy?.();
      } catch {
        // ignore
      }

      renderTaskRef.current = null;
      pdfDocRef.current = null;
      renderingRef.current = false;
    };
  }, [content, source]);

  // Render page when parameters change
  useEffect(() => {
    if (pdfDocRef.current && !loading) {
      renderPage();
    }
  }, [currentPage, scale, rotation, loading, renderPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, numPages)));
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = async () => {
    try {
      const bytes = await readBinaryPreviewAsUint8Array({ source, content });
      const blob = new Blob([bytes], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-lg font-medium">PDF Loading Failed</p>
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={handleDownload}
          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="inline h-4 w-4 mr-1.5" />
          Download PDF
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium min-w-[5rem] text-center">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handleRotate}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Rotate"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Download"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4">
        <canvas
          ref={canvasRef}
          className="shadow-lg rounded-sm bg-white"
        />
      </div>
    </div>
  );
}
