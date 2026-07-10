"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  RotateCwIcon,
  AlertCircleIcon,
} from "./icons";
import { readBinaryPreviewAsUint8Array } from "./core/binary";
import { resolveAssetPath } from "./core/config";
import type { PreviewSource } from "./core/types";
import "./styles/PdfPreview.css";

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

function getCanvasOutputScale() {
  if (typeof window === "undefined") return 1;
  const ratio = window.devicePixelRatio || 1;
  return Number.isFinite(ratio) && ratio > 1 ? ratio : 1;
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
  const renderRequestIdRef = useRef(0);

  const renderPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current) return;

    const requestId = renderRequestIdRef.current + 1;
    renderRequestIdRef.current = requestId;

    const prevTask = renderTaskRef.current;
    if (prevTask) {
      try { prevTask.cancel(); } catch { /* ignore */ }
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      if (requestId !== renderRequestIdRef.current || !canvasRef.current) return;

      const viewport = page.getViewport({ scale, rotation });
      const outputScale = getCanvasOutputScale();
      const renderViewport = outputScale === 1
        ? viewport
        : page.getViewport({ scale: scale * outputScale, rotation });
      const displayCanvas = canvasRef.current;
      const context = displayCanvas.getContext("2d");
      if (!context) return;

      const offscreen = document.createElement("canvas");
      offscreen.width = Math.max(1, Math.floor(renderViewport.width));
      offscreen.height = Math.max(1, Math.floor(renderViewport.height));
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      const renderTask = page.render({
        canvasContext: offCtx,
        viewport: renderViewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (requestId !== renderRequestIdRef.current || canvasRef.current !== displayCanvas) {
        return;
      }

      displayCanvas.width = offscreen.width;
      displayCanvas.height = offscreen.height;
      displayCanvas.style.width = `${viewport.width}px`;
      displayCanvas.style.height = `${viewport.height}px`;
      context.drawImage(offscreen, 0, 0);

    } catch (err: unknown) {
      const errObj = err as { name?: string };
      if (errObj?.name === "RenderingCancelledException") return;
      if (requestId === renderRequestIdRef.current) {
        console.error("Error rendering PDF page:", err);
      }
    } finally {
      if (requestId === renderRequestIdRef.current) {
        renderTaskRef.current = null;
      }
    }
  }, [currentPage, scale, rotation]);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");

        pdfjsLib.GlobalWorkerOptions.workerSrc = resolveAssetPath(
          "/vendor/pdfjs/pdf.worker.min.mjs",
        );

        const bytes = await readBinaryPreviewAsUint8Array({ source, content });

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          await pdf.destroy?.();
          return;
        }

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
      renderRequestIdRef.current += 1;

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
    };
  }, [content, source]);

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
      const pdfBytes = new Uint8Array(bytes.byteLength);
      pdfBytes.set(bytes);
      const blob = new Blob([pdfBytes.buffer], { type: "application/pdf" });

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
      <div className="fv-loading" style={{ minHeight: 400 }}>
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-loading__label">Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fv-pdf__error">
        <AlertCircleIcon size={48} />
        <p className="fv-pdf__error-title">PDF Loading Failed</p>
        <p className="fv-pdf__error-msg">{error}</p>
        <button onClick={handleDownload} className="fv-btn fv-btn--primary" style={{ marginTop: '0.5rem' }}>
          <DownloadIcon size={16} /> Download PDF
        </button>
      </div>
    );
  }

  return (
    <div className="fv-pdf">
      <div className="fv-pdf__toolbar">
        <div className="fv-pdf__nav">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="fv-btn fv-btn--icon"
            title="Previous page"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <span className="fv-pdf__page-info">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="fv-btn fv-btn--icon"
            title="Next page"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        <div className="fv-pdf__controls">
          <button onClick={handleZoomOut} className="fv-btn fv-btn--icon" title="Zoom Out">
            <ZoomOutIcon size={16} />
          </button>
          <span className="fv-pdf__zoom-label">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="fv-btn fv-btn--icon" title="Zoom In">
            <ZoomInIcon size={16} />
          </button>
          <div className="fv-toolbar__separator" />
          <button onClick={handleRotate} className="fv-btn fv-btn--icon" title="Rotate">
            <RotateCwIcon size={16} />
          </button>
          <button onClick={handleDownload} className="fv-btn fv-btn--icon" title="Download">
            <DownloadIcon size={16} />
          </button>
        </div>
      </div>

      <div className="fv-pdf__canvas-area">
        <canvas ref={canvasRef} className="fv-pdf__canvas" />
      </div>
    </div>
  );
}
