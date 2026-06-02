"use client";

import { useState, useEffect, useMemo } from "react";
import { Code, Eye } from "lucide-react";

interface HtmlPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

export function HtmlPreview({ content, fileName }: HtmlPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Create a blob URL for sandboxed iframe rendering (with cleanup to avoid memory leaks)
  const blobUrl = useMemo(() => {
    const blob = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("preview")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "preview"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="Preview mode"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "source"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="Source code"
          >
            <Code size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          <iframe
            src={blobUrl}
            sandbox="allow-same-origin"
            className="w-full h-full border-0"
            style={{ minHeight: "500px" }}
            title={fileName}
          />
        ) : (
          <div className="overflow-auto h-full">
            <pre className="p-4 text-sm font-mono bg-[#282c34] text-[#abb2bf] leading-relaxed overflow-auto">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
