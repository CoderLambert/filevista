"use client";

import { useState, useEffect, useMemo } from "react";
import { EyeIcon, Code2Icon } from "./icons";
import { ShikiSourceView } from "./ShikiSourceView";
import { useLocale } from "./core/i18n";
import "./styles/HtmlPreview.css";
import "./styles/ViewModeBar.css";

interface HtmlPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "preview" | "source";
type HtmlSecurityMode = "safe" | "trusted";

export function HtmlPreview({ content, fileName }: HtmlPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const t = useLocale();

  const [securityMode] = useState<HtmlSecurityMode>("safe");
  const sandbox =
    securityMode === "trusted" ? "allow-scripts allow-same-origin" : "";

  const blobUrl = useMemo(() => {
    const blob = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="fv-html">
      <div className="fv-view-mode-bar">
        <div className="fv-view-mode-group">
          <button
            onClick={() => setViewMode("preview")}
            className={`fv-view-mode-btn ${viewMode === "preview" ? "fv-view-mode-btn--active" : ""}`}
          >
            <EyeIcon size={13} />
            {t.preview}
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`fv-view-mode-btn ${viewMode === "source" ? "fv-view-mode-btn--active" : ""}`}
          >
            <Code2Icon size={13} />
            {t.source}
          </button>
        </div>
      </div>

      <div className="fv-html__content">
        {viewMode === "preview" ? (
          <iframe
            src={blobUrl}
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            className="fv-html__iframe"
            title={fileName}
          />
        ) : (
          <ShikiSourceView content={content} fileName={fileName} language="html" />
        )}
      </div>
    </div>
  );
}
