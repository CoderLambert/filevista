import { ZoomInIcon, ZoomOutIcon, RotateCwIcon } from "./icons";
import { useState } from "react";
import "./styles/ImagePreview.css";

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
    <div className="fv-image">
      <div className="fv-image__toolbar">
        <button onClick={handleZoomOut} className="fv-btn fv-btn--icon" title="Zoom Out">
          <ZoomOutIcon size={16} />
        </button>
        <span className="fv-image__zoom-label">{zoom}%</span>
        <button onClick={handleZoomIn} className="fv-btn fv-btn--icon" title="Zoom In">
          <ZoomInIcon size={16} />
        </button>
        <div className="fv-toolbar__separator" />
        <button onClick={handleRotate} className="fv-btn fv-btn--icon" title="Rotate">
          <RotateCwIcon size={16} />
        </button>
        <button onClick={handleReset} className="fv-image__reset-btn">
          Reset
        </button>
      </div>

      <div className="fv-image__canvas">
        <img
          src={url}
          alt={fileName}
          className="fv-image__img"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}
