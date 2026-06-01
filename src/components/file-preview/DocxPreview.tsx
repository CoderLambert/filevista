"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { renderAsync } from "docx-preview";

interface DocxPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

export function DocxPreview({ content, fileName }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const renderDocument = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Decode base64 to ArrayBuffer
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Clear previous content
      containerRef.current.innerHTML = "";

      await renderAsync(bytes.buffer, containerRef.current, undefined, {
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

      // Count pages
      const pages = containerRef.current.querySelectorAll(
        ".docx-wrapper > section"
      );
      setPageCount(pages.length);
    } catch (err) {
      console.error("Error rendering DOCX:", err);
      setError(err instanceof Error ? err.message : "Failed to render document");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => {
    renderDocument();
  }, [renderDocument]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Rendering document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-lg font-medium">Rendering Failed</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Document info bar */}
      {pageCount > 0 && (
        <div className="px-4 py-1.5 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground">
            {pageCount} page{pageCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Document content */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800/50">
        {/* docx-preview container styles */}
        <style dangerouslySetInnerHTML={{ __html: DOCX_PREVIEW_STYLES }} />
        <div
          ref={containerRef}
          className="docx-preview-container"
        />
      </div>
    </div>
  );
}

// Styles for docx-preview rendering
const DOCX_PREVIEW_STYLES = `
  /* Container layout */
  .docx-preview-container {
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Override docx-wrapper to center pages */
  .docx-preview-container .docx-wrapper {
    background: transparent !important;
    padding: 0 !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  /* Page styling */
  .docx-preview-container .docx-wrapper > section.docx {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08) !important;
    margin-bottom: 0 !important;
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .docx-preview-container .docx-wrapper > section.docx {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3) !important;
    }
  }

  /* Ensure images scale within pages */
  .docx-preview-container .docx-wrapper img {
    max-width: 100%;
    height: auto;
  }

  /* Fix table rendering */
  .docx-preview-container .docx-wrapper table {
    border-collapse: collapse;
  }
`;
