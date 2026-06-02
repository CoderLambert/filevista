"use client";

import { useState, useEffect, useMemo } from "react";
import { Code, Eye, Copy, Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface SvgPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "rendered" | "code" | "split";

export function SvgPreview({ content, fileName }: SvgPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("rendered");
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const codeView = (
    <div className="relative h-full">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
        title="Copy SVG code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="p-4 text-xs font-mono bg-[#282c34] text-[#abb2bf] leading-relaxed overflow-auto h-full">
        <code>{content}</code>
      </pre>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground">{fileName}</span>
        <div className="flex items-center gap-1">
          {(["rendered", "split", "code"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {mode === "rendered" ? "Preview" : mode === "code" ? "Code" : "Split"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-hidden ${viewMode === "split" ? "flex" : ""}`}>
        {(viewMode === "rendered" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2 border-r" : "w-full h-full"}`}>
            {renderedView}
          </div>
        )}
        {(viewMode === "code" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2" : "w-full h-full"}`}>
            {codeView}
          </div>
        )}
      </div>
    </div>
  );
}
