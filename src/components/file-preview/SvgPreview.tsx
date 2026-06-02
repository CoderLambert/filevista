"use client";

import { useState, useEffect, useMemo } from "react";
import { Eye, Code2, Columns2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { ShikiSourceView } from "./ShikiSourceView";

interface SvgPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "rendered" | "source" | "split";

export function SvgPreview({ content, fileName }: SvgPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("rendered");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const svgUrl = useMemo(() => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }, [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(svgUrl);
  }, [svgUrl]);

  const renderedView = (
    <div className="flex flex-col h-full">
      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-2 p-2 border-b bg-muted/30">
        <button onClick={() => setZoom(z => Math.max(z - 25, 25))} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <span className="text-xs font-mono min-w-[3rem] text-center">{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(z + 25, 400))} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Rotate">
          <RotateCw size={14} />
        </button>
        <button onClick={() => { setZoom(100); setRotation(0); }} className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors">Reset</button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
        <img
          src={svgUrl}
          alt={fileName}
          className="max-w-full transition-transform duration-200"
          style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle bar */}
      <div className="flex items-center border-b bg-muted/20">
        <div className="flex items-center px-2 py-1 gap-0.5">
          <button
            onClick={() => setViewMode("rendered")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "rendered"
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Eye size={13} />
            预览
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "source"
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Code2 size={13} />
            源码
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "split"
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Columns2 size={13} />
            分栏
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 ${viewMode === "split" ? "flex" : ""}`}>
        {(viewMode === "rendered" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2 border-r" : "w-full h-full"}`}>
            {renderedView}
          </div>
        )}
        {(viewMode === "source" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2" : "w-full h-full"}`}>
            <ShikiSourceView content={content} fileName={fileName} language="xml" />
          </div>
        )}
      </div>
    </div>
  );
}
