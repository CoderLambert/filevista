"use client";

import { useState, useEffect, useMemo } from "react";
import { Eye, Code2 } from "lucide-react";
import { ShikiSourceView } from "./ShikiSourceView";

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
      {/* View mode toggle bar */}
      <div className="flex items-center border-b bg-muted/20">
        <div className="flex items-center px-2 py-1 gap-0.5">
          <button
            onClick={() => setViewMode("preview")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "preview"
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Eye size={13} />
            预览
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "source"
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Code2 size={13} />
            源码
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {viewMode === "preview" ? (
          <iframe
            src={blobUrl}
            sandbox="allow-same-origin"
            className="w-full h-full border-0"
            style={{ minHeight: "500px" }}
            title={fileName}
          />
        ) : (
          <ShikiSourceView content={content} fileName={fileName} language="html" />
        )}
      </div>
    </div>
  );
}
