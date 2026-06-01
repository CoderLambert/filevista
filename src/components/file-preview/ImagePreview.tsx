"use client";

import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useState } from "react";

interface ImagePreviewProps {
  url: string;
  fileName: string;
}

export function ImagePreview({ url, fileName }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 p-3 border-b bg-muted/30">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-sm font-mono min-w-[4rem] text-center">
          {zoom}%
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
          onClick={handleReset}
          className="px-3 py-1 rounded-md text-xs hover:bg-muted transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Image container */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
        <img
          src={url}
          alt={fileName}
          className="max-w-full transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}
