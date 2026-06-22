"use client";

import { useEffect, useState, useRef } from "react";
import { AlertCircleIcon } from "./icons";
import { readBinaryPreviewAsArrayBuffer } from "./core/binary";
import type { PreviewSource } from "./core/types";
import "./styles/DocxPreview.css";

interface DocxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
}

export function DocxPreview({ content, source, fileName }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const [prevDeps, setPrevDeps] = useState({ content, source });
  if (prevDeps.content !== content || prevDeps.source !== source) {
    setPrevDeps({ content, source });
    setLoading(true);
    setError(null);
    setPageCount(0);
  }

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;

        const buffer = await readBinaryPreviewAsArrayBuffer({ source, content });
        if (cancelled) return;

        container.innerHTML = "";

        await renderAsync(buffer, container, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        if (cancelled) return;

        const pages = container.querySelectorAll(".docx-wrapper > section");
        setPageCount(pages.length);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Error rendering DOCX:", err);
        setError(err instanceof Error ? err.message : "Failed to render document");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [content, source]);

  return (
    <div className="fv-docx">
      {pageCount > 0 && !loading && (
        <div className="fv-docx__info-bar">
          <span>{fileName}</span>
          <span>{pageCount} page{pageCount !== 1 ? "s" : ""}</span>
        </div>
      )}

      <div className="fv-docx__viewport">
        {loading && (
          <div className="fv-docx__overlay">
            <div className="fv-docx__overlay-spinner">
              <div className="fv-spinner fv-spinner--lg" />
            </div>
            <p style={{ fontSize: 'var(--fv-font-size-sm)', color: 'var(--fv-muted-foreground)' }}>Rendering document...</p>
          </div>
        )}

        {error && (
          <div className="fv-docx__overlay">
            <AlertCircleIcon size={48} />
            <p className="fv-docx__overlay-title">Rendering Failed</p>
            <p className="fv-docx__overlay-msg">{error}</p>
          </div>
        )}

        <div ref={containerRef} className="docx-preview-container" />
      </div>
    </div>
  );
}
