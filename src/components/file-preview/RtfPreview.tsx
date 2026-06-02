"use client";

import { useState } from "react";
import { Eye, Code2 } from "lucide-react";
import { ShikiSourceView } from "./ShikiSourceView";

interface RtfPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

/**
 * Basic RTF text extractor.
 * RTF format uses {\rtf1 ...} with control words like \b, \i, \par, etc.
 * This extracts plain text by stripping control words and braces.
 */
function extractRtfText(rtf: string): string[] {
  const paragraphs: string[] = [];

  // Remove header groups like {\rtf1\ansi\deff0...}
  let text = rtf;

  // Remove binary data ({\*\...} groups)
  text = text.replace(/\{\\[\*]([^{}]*)\}/g, "");

  // Remove font table, color table, etc.
  text = text.replace(/\{\\fonttbl[^}]*\}/gi, "");
  text = text.replace(/\{\\colortbl[^}]*\}/gi, "");
  text = text.replace(/\{\\stylesheet[^}]*\}/gi, "");
  text = text.replace(/\{\\info[^}]*\}/gi, "");
  text = text.replace(/\{\\generator[^}]*\}/gi, "");

  // Replace \par and \line with newlines
  text = text.replace(/\\par\b/g, "\n");
  text = text.replace(/\\line\b/g, "\n");
  text = text.replace(/\\tab\b/g, "\t");

  // Remove remaining control words (\word followed by optional number and space)
  text = text.replace(/\\[a-z]+(-?\d+)? ?/gi, "");

  // Remove special characters
  text = text.replace(/\\['"][0-9a-f]{2}/gi, ""); // hex chars
  text = text.replace(/\\[{}\\]/g, (match) => {
    switch (match) {
      case "\\\\": return "\\";
      case "\\{": return "{";
      case "\\}": return "}";
      default: return "";
    }
  });

  // Remove remaining braces
  text = text.replace(/[{}]/g, "");

  // Clean up whitespace
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");

  // Split into paragraphs
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      paragraphs.push(trimmed);
    }
  }

  return paragraphs;
}

export function RtfPreview({ content, fileName }: RtfPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const paragraphs = extractRtfText(content);

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
          <div className="overflow-auto h-full p-6">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <span className="text-sm">📃</span>
                <span className="text-xs text-muted-foreground">{fileName}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">RTF Format</span>
              </div>
              <div className="space-y-3">
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${
                      i === 0 && para.length < 100 ? "text-lg font-semibold text-gray-900 dark:text-gray-100" : ""
                    }`}
                  >
                    {para}
                  </p>
                ))}
                {paragraphs.length === 0 && (
                  <p className="text-muted-foreground text-sm">No text content could be extracted.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <ShikiSourceView content={content} fileName={fileName} language="ini" />
        )}
      </div>
    </div>
  );
}
