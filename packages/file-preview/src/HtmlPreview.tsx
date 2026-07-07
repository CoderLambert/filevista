"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  Code2Icon,
  ShieldCheckIcon,
  ZapIcon,
} from "./icons";
import { ShikiSourceView } from "./ShikiSourceView";
import { useLocale } from "./core/i18n";
import "./styles/HtmlPreview.css";

interface HtmlPreviewProps {
  content: string;
  fileName: string;
  onTrustedPreviewRequest?: HtmlTrustedPreviewRequestHandler;
}

type ViewMode = "preview" | "source";
export type HtmlSecurityMode = "safe" | "trusted";

export interface HtmlTrustedPreviewRequest {
  fileName: string;
  confirm: () => void;
  cancel: () => void;
}

export type HtmlTrustedPreviewRequestHandler = (
  request: HtmlTrustedPreviewRequest,
) => void;

export function HtmlPreview({
  content,
  fileName,
  onTrustedPreviewRequest,
}: HtmlPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [securityMode, setSecurityMode] = useState<HtmlSecurityMode>("safe");
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const modeMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isModeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        modeMenuRef.current &&
        !modeMenuRef.current.contains(event.target as Node)
      ) {
        setIsModeMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModeMenuOpen]);

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

  const showSafePreview = () => {
    setSecurityMode("safe");
    setViewMode("preview");
    setIsModeMenuOpen(false);
  };

  const enableTrustedPreview = () => {
    setSecurityMode("trusted");
    setViewMode("preview");
    setIsModeMenuOpen(false);
  };

  const requestTrustedPreview = () => {
    setViewMode("preview");
    setIsModeMenuOpen(false);

    if (securityMode === "trusted") return;

    if (!onTrustedPreviewRequest) {
      enableTrustedPreview();
      return;
    }

    onTrustedPreviewRequest({
      fileName,
      confirm: enableTrustedPreview,
      cancel: () => setSecurityMode("safe"),
    });
  };

  return (
    <div className="fv-html">
      <div className="fv-html__toolbar">
        <div className="fv-html__mode-picker" ref={modeMenuRef}>
          <button
            type="button"
            onClick={() => setIsModeMenuOpen((open) => !open)}
            className={`fv-html__mode-trigger ${viewMode === "preview" ? "fv-html__mode-trigger--active" : ""}`}
            aria-expanded={isModeMenuOpen}
            aria-haspopup="menu"
          >
            {securityMode === "trusted" ? (
              <ZapIcon size={13} />
            ) : (
              <ShieldCheckIcon size={13} />
            )}
            <span>
              {securityMode === "trusted"
                ? t.htmlTrustedPreview
                : t.htmlSafePreview}
            </span>
            <ChevronDownIcon size={12} className="fv-html__chevron" />
          </button>

          {isModeMenuOpen && (
            <div className="fv-html__mode-menu" role="menu">
              <button
                type="button"
                className={`fv-html__mode-option ${securityMode === "safe" ? "fv-html__mode-option--active" : ""}`}
                onClick={showSafePreview}
                role="menuitem"
              >
                <span className="fv-html__mode-icon fv-html__mode-icon--safe">
                  <ShieldCheckIcon size={14} />
                </span>
                <span className="fv-html__mode-copy">
                  <span className="fv-html__mode-title">
                    {t.htmlSafePreview}
                  </span>
                  <span className="fv-html__mode-desc">
                    {t.htmlSafePreviewDesc}
                  </span>
                </span>
                {securityMode === "safe" && <CheckIcon size={16} />}
              </button>

              <button
                type="button"
                className={`fv-html__mode-option ${securityMode === "trusted" ? "fv-html__mode-option--active" : ""}`}
                onClick={requestTrustedPreview}
                role="menuitem"
              >
                <span className="fv-html__mode-icon fv-html__mode-icon--trusted">
                  <ZapIcon size={14} />
                </span>
                <span className="fv-html__mode-copy">
                  <span className="fv-html__mode-title">
                    {t.htmlTrustedPreview}
                  </span>
                  <span className="fv-html__mode-desc">
                    {t.htmlTrustedPreviewDesc}
                  </span>
                </span>
                {securityMode === "trusted" && <CheckIcon size={16} />}
              </button>
            </div>
          )}
        </div>

        <div className="fv-html__toolbar-divider" />

        <div className="fv-html__source-group">
          <button
            onClick={() => setViewMode("source")}
            className={`fv-html__source-btn ${viewMode === "source" ? "fv-html__source-btn--active" : ""}`}
            type="button"
          >
            <Code2Icon size={13} />
            {t.source}
          </button>
        </div>
      </div>

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
