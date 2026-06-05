"use client";

import { useState, useEffect } from "react";
import { Eye, Code2 } from "lucide-react";
import DOMPurify from "dompurify";
import { ShikiSourceView } from "./ShikiSourceView";

interface RtfPreviewProps {
  content: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

// ── RTF text extraction (fallback for complex / unrenderable RTF) ──

/**
 * Basic RTF text extractor.
 * RTF format uses {\rtf1 ...} with control words like \b, \i, \par, etc.
 * This extracts plain text by stripping control words and braces.
 */
function extractRtfText(rtf: string): string[] {
  const paragraphs: string[] = [];

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

// ── RTF → HTML via rtf.js + DOMPurify ──

/**
 * Convert RTF raw text string to sanitized HTML string.
 * Uses rtf.js to parse and render RTF as HTML, then DOMPurify to sanitize.
 * Returns null if parsing or rendering fails.
 */
async function buildRtfHtml(
  rtfText: string,
): Promise<{ html: string | null; error: string | null }> {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(rtfText);
    const arrayBuffer = bytes.buffer as ArrayBuffer;

    const RTFJS = await import("rtf.js");
    const doc = new RTFJS.Document(arrayBuffer, {});

    const elements = await doc.render();

    // Serialize elements to HTML string
    const container = document.createElement("div");
    for (const el of elements) {
      container.appendChild(el);
    }
    const rawHtml = container.innerHTML;

    // Sanitize with DOMPurify — strip scripts, event handlers, and dangerous URLs
    const sanitized = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["style", "class", "colspan", "rowspan"],
      ALLOWED_TAGS: [
        "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s",
        "sub", "sup", "ul", "ol", "li", "table", "thead", "tbody", "tr",
        "th", "td", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
        "blockquote", "pre", "code", "hr", "font", "center", "strike",
      ],
      ALLOWED_ATTR: [
        "href", "src", "alt", "title", "width", "height", "colspan",
        "rowspan", "align", "valign", "border", "cellpadding", "cellspacing",
        "class", "style",
      ],
    });

    return { html: sanitized, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { html: null, error: message };
  }
}

/**
 * Build a complete HTML document suitable for iframe srcDoc.
 * Injects base styles and the sanitized content.
 */
function buildIframeDoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; background: #fff; }
  body { padding: 24px; }
  p { margin-bottom: 0.75rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  a { color: #2563eb; text-decoration: underline; }
  blockquote { border-left: 3px solid #e5e7eb; padding-left: 16px; margin: 12px 0; color: #6b7280; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
  code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-size: 13px; }
  pre code { background: none; padding: 0; }
  ul, ol { padding-left: 24px; margin-bottom: 0.75rem; }
  li { margin-bottom: 0.25rem; }
  h1 { font-size: 24px; margin-bottom: 12px; }
  h2 { font-size: 20px; margin-bottom: 10px; }
  h3 { font-size: 16px; margin-bottom: 8px; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  @media (prefers-color-scheme: dark) {
    html, body { color: #d1d5db; background: #1f2937; }
    th { background: #374151; }
    th, td { border-color: #4b5563; }
    pre { background: #111827; }
    code { background: #111827; }
    blockquote { border-color: #4b5563; color: #9ca3af; }
    a { color: #60a5fa; }
    hr { border-color: #4b5563; }
  }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ── RtfPreview component ──

export function RtfPreview({ content, fileName }: RtfPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    buildRtfHtml(content).then((result) => {
      if (!cancelled) {
        if (result.html !== null) {
          setIframeHtml(buildIframeDoc(result.html));
          setRenderError(null);
        } else {
          setIframeHtml(null);
          setRenderError(result.error);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content]);

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
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm border">
              {/* File info header */}
              <div className="flex items-center gap-2 px-6 py-3 border-b">
                <span className="text-sm">📃</span>
                <span className="text-xs text-muted-foreground">{fileName}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">RTF Format</span>
              </div>

              {/* Rendered content */}
              <div className="p-6 sm:p-8">
                {iframeHtml ? (
                  <iframe
                    srcDoc={iframeHtml}
                    sandbox="allow-same-origin"
                    className="w-full border-0"
                    style={{ minHeight: "400px" }}
                    title={`Preview of ${fileName}`}
                  />
                ) : renderError ? (
                  /* Fallback: text extraction when rtf.js fails */
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
                      <span className="text-xs">⚠️</span>
                      <span className="text-xs">
                        富文本渲染不可用，已降级为纯文本预览
                      </span>
                    </div>
                    {paragraphs.map((para, i) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                      >
                        {para}
                      </p>
                    ))}
                    {paragraphs.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        无法从文件中提取文本内容。
                      </p>
                    )}
                  </div>
                ) : (
                  /* Still loading / processing */
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    正在解析 RTF...
                  </div>
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
