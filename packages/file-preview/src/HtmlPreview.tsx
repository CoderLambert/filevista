"use client";

import { useState, useEffect } from "react";
import { EyeIcon, Code2Icon, AlertTriangleIcon } from "./icons";
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
  const [securityMode, setSecurityMode] = useState<HtmlSecurityMode>("safe");
  const [blobUrl, setBlobUrl] = useState<string>("");
  const t = useLocale();

  // Build blob URL in an effect (not useMemo) so the cleanup runs exactly
  // once per `content` change. Returning the revoke from the effect cleanup
  // avoids two failure modes:
  //   1. useMemo returning a fresh blob each render but the old URL never
  //      being revoked → leak.
  //   2. StrictMode double-invoking the effect cleanup → revoking a URL
  //      that's still in use, causing iframe flashes.
  useEffect(() => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [content]);

  // sandbox:
  //   "safe"     → "" (most restrictive: no scripts, no forms, no popups,
  //                       treated as unique origin; CSS + text + images still work)
  //   "trusted"  → "allow-scripts allow-same-origin allow-popups allow-forms"
  //                (enables interactive HTML; user must opt in via the toggle)
  //
  // We do NOT default to "trusted" — running untrusted HTML with scripts
  // enabled is a known XSS vector. The toggle lets a user explicitly accept
  // that risk for files they trust.
  const sandbox =
    securityMode === "trusted"
      ? "allow-scripts allow-same-origin allow-popups allow-forms"
      : "";

  const toggleSecurity = () => {
    setSecurityMode((prev) => (prev === "safe" ? "trusted" : "safe"));
  };

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

        <div className="fv-view-mode-group">
          <button
            onClick={toggleSecurity}
            className={`fv-view-mode-btn ${securityMode === "trusted" ? "fv-view-mode-btn--active" : ""}`}
            title={t.htmlTrustedModeHint}
          >
            <AlertTriangleIcon size={13} />
            {securityMode === "trusted"
              ? t.htmlDisableScripts
              : t.htmlEnableScripts}
          </button>
        </div>
      </div>

      {securityMode === "trusted" && (
        <div className="fv-html__hint">{t.htmlTrustedModeHint}</div>
      )}

      <div className="fv-html__content">
        {viewMode === "preview" ? (
          blobUrl ? (
            <iframe
              key={securityMode}
              src={blobUrl}
              sandbox={sandbox}
              referrerPolicy="no-referrer"
              className="fv-html__iframe"
              title={fileName}
            />
          ) : null
        ) : (
          <ShikiSourceView content={content} fileName={fileName} language="html" />
        )}
      </div>
    </div>
  );
}
