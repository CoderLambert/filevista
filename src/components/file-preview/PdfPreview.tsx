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

interface PdfPreviewProps {
  base64Content: string;
  fileName: string;
}

export function PdfPreview({ base64Content, fileName }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<unknown>(null);

  const renderPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current as
      | { getPage: (n: number) => Promise<unknown> }
      | null;
    if (!pdfDoc || !canvasRef.current || rendering) return;

    setRendering(true);
    try {
      const page = (await pdfDoc.getPage(currentPage)) as {
        getViewport: (opts: { scale: number; rotation: number }) => {
          width: number;
          height: number;
        };
        render: (opts: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      };

      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;
    } catch (err) {
      console.error("Error rendering PDF page:", err);
    } finally {
      setRendering(false);
    }
  }, [currentPage, scale, rotation, rendering]);

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
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        // Decode base64 to Uint8Array
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

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
    };
  }, [base64Content]);

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

  const handleDownload = () => {
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="relative">
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="shadow-lg rounded-sm bg-white"
          />
        </div>
      </div>
    </div>
  );
}
