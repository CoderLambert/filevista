import { useState, useEffect, useMemo } from "react";
import { EyeIcon, Code2Icon, Columns2Icon, ZoomInIcon, ZoomOutIcon, RotateCwIcon } from "./icons";
import { ShikiSourceView } from "./ShikiSourceView";
import { useLocale } from "./core/i18n";
import "./styles/SvgPreview.css";

interface SvgPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "rendered" | "source" | "split";

export function SvgPreview({ content, fileName }: SvgPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("rendered");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const t = useLocale();

  const svgUrl = useMemo(() => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }, [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(svgUrl);
  }, [svgUrl]);

  const renderedView = (
    <div className="fv-svg__panel">
      <div className="fv-svg__toolbar">
        <button onClick={() => setZoom(z => Math.max(z - 25, 25))} className="fv-btn fv-btn--icon" title="Zoom Out">
          <ZoomOutIcon size={14} />
        </button>
        <span className="fv-svg__zoom-label">{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(z + 25, 400))} className="fv-btn fv-btn--icon" title="Zoom In">
          <ZoomInIcon size={14} />
        </button>
        <div className="fv-toolbar__separator" />
        <button onClick={() => setRotation(r => (r + 90) % 360)} className="fv-btn fv-btn--icon" title="Rotate">
          <RotateCwIcon size={14} />
        </button>
        <button onClick={() => { setZoom(100); setRotation(0); }} className="fv-svg__reset-btn">Reset</button>
      </div>
      <div className="fv-svg__canvas">
        <img
          src={svgUrl}
          alt={fileName}
          className="fv-svg__img"
          style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
        />
      </div>
    </div>
  );

  return (
    <div className="fv-svg">
      <div className="fv-svg__mode-bar">
        <div className="fv-svg__mode-group">
          <button
            onClick={() => setViewMode("rendered")}
            className={`fv-svg__mode-btn ${viewMode === "rendered" ? "fv-svg__mode-btn--active" : ""}`}
          >
            <EyeIcon size={13} />
            {t.preview}
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`fv-svg__mode-btn ${viewMode === "source" ? "fv-svg__mode-btn--active" : ""}`}
          >
            <Code2Icon size={13} />
            {t.source}
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`fv-svg__mode-btn ${viewMode === "split" ? "fv-svg__mode-btn--active" : ""}`}
          >
            <Columns2Icon size={13} />
            {t.split}
          </button>
        </div>
      </div>

      <div className="fv-svg__content">
        {(viewMode === "rendered" || viewMode === "split") && (
          <div className={`fv-svg__panel ${viewMode === "split" ? "fv-svg__panel--split" : ""}`}>
            {renderedView}
          </div>
        )}
        {(viewMode === "source" || viewMode === "split") && (
          <div className={`fv-svg__panel ${viewMode === "split" ? "fv-svg__panel--split-source" : ""}`}>
            <ShikiSourceView content={content} fileName={fileName} language="xml" />
          </div>
        )}
      </div>
    </div>
  );
}
