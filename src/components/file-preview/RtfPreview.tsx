"use client";

import { useState, useMemo } from "react";
import { Eye, Code2 } from "lucide-react";
import DOMPurify from "dompurify";
import { parseRTF } from "@jonahschulte/rtf-toolkit";
import { ShikiSourceView } from "./ShikiSourceView";
import { renderRtfAstToHtml } from "./rtf/render-rtf";

interface RtfPreviewProps {
  /** Raw RTF text string (used for parsing, source view, and text-extraction fallback). */
  rawText: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

// ── RTF text extraction (fallback for unparseable RTF) ──

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

// ── RTF → HTML via @jonahschulte/rtf-toolkit + DOMPurify ──

/**
 * Convert RTF text to sanitized HTML string.
 *
 * Pipeline:
 *   1. `@jonahschulte/rtf-toolkit` parses the RTF text into an AST.
 *   2. Our `renderRtfAstToHtml` walks the AST and emits clean semantic HTML
 *      (`<h1>/<h2>/<h3>/<p>` with inline `<strong>/<em>/<u>` runs). The
 *      toolkit's built-in `toHTML()` collapses everything into a single
 *      `<p>` because it doesn't split on `{\pard ... \par}` groups, so we
 *      bypass it.
 *   3. DOMPurify sanitizes the result against XSS.
 *
 * @returns `{ html }` on success, or `{ error }` on parser failure — caller
 *   falls back to plain-text extraction in that case.
 */
function buildRtfHtml(
  rawText: string,
): { html: string | null; error: string | null } {
  try {
    const doc = parseRTF(rawText);
    const rawHtml = renderRtfAstToHtml(doc);

    // Sanitize with DOMPurify — strip scripts, event handlers, dangerous URLs
    const sanitized = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: {
        html: true,
        svg: true,
        svgFilters: true,
      },
      FORBID_TAGS: [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "width",
        "height",
        "colspan",
        "rowspan",
        "align",
        "valign",
        "border",
        "cellpadding",
        "cellspacing",
        "class",
        "style",
      ],
    });

    return { html: sanitized, error: null };
  } catch (err) {
    // Expected: not every RTF in the wild is parseable. The caller falls back
    // to plain-text extraction, so log at `warn` to avoid Next.js's dev-overlay
    // treating this recoverable case as an application error.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[FileVista][RTF] rich render failed, falling back to text:", message);
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
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", Roboto, "Helvetica Neue",
      Arial, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #1f2937;
    background: #fff;
  }
  body { padding: 32px 40px; max-width: 860px; margin: 0 auto; }
  h1, h2, h3 { line-height: 1.3; font-weight: 600; color: #111827; }
  h1 { font-size: 1.75rem; margin: 1.4rem 0 0.9rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb; }
  h2 { font-size: 1.4rem; margin: 1.3rem 0 0.7rem; padding-bottom: 0.35rem; border-bottom: 1px solid #e5e7eb; }
  h3 { font-size: 1.15rem; margin: 1.1rem 0 0.55rem; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  p { margin: 0 0 0.8rem; }
  p:last-child { margin-bottom: 0; }
  strong { font-weight: 600; color: #111827; }
  em { font-style: italic; }
  u { text-decoration: underline; text-underline-offset: 2px; }
  table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  a { color: #2563eb; text-decoration: underline; }
  blockquote {
    border-left: 3px solid #d1d5db;
    padding: 0.25rem 0 0.25rem 1rem;
    margin: 0.8rem 0;
    color: #4b5563;
  }
  pre { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; margin: 0.8rem 0; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre code { background: none; padding: 0; }
  ul, ol { padding-left: 1.6rem; margin: 0 0 0.8rem; }
  li { margin-bottom: 0.25rem; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2rem 0; }
  @media (prefers-color-scheme: dark) {
    html, body { color: #d1d5db; background: #111827; }
    h1, h2, h3 { color: #f3f4f6; }
    h1, h2 { border-color: #374151; }
    strong { color: #f9fafb; }
    th { background: #1f2937; }
    th, td { border-color: #374151; }
    pre, code { background: #1f2937; }
    blockquote { border-color: #4b5563; color: #9ca3af; }
    a { color: #60a5fa; }
    hr { border-color: #374151; }
  }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ── RtfPreview component ──

export function RtfPreview({ rawText, fileName }: RtfPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // parseRTF + toHTML are pure & synchronous — useMemo, not useEffect.
  const { iframeHtml, renderError } = useMemo(() => {
    const result = buildRtfHtml(rawText);
    return {
      iframeHtml: result.html !== null ? buildIframeDoc(result.html) : null,
      renderError: result.error,
    };
  }, [rawText]);

  const paragraphs = useMemo(() => extractRtfText(rawText), [rawText]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: file info + view mode toggle */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">📃</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {fileName}
          </span>
          <span className="text-[10px] text-muted-foreground/60">RTF</span>
        </div>
        <div className="flex items-center gap-0.5">
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

      {/* Content area — fills remaining height */}
      <div className="flex-1 min-h-0">
        {viewMode === "preview" ? (
          iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              sandbox=""
              className="w-full h-full border-0"
              style={{ minHeight: "500px" }}
              title={`Preview of ${fileName}`}
            />
          ) : renderError ? (
            /* Fallback: text extraction when rtf-toolkit fails */
            <div className="overflow-auto h-full p-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400">
                  <span className="text-sm">⚠️</span>
                  <span className="text-xs">
                    富文本渲染不可用，已降级为纯文本预览
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 space-y-3">
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
              </div>
            </div>
          ) : (
            /* Still loading / processing */
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              正在解析 RTF...
            </div>
          )
        ) : (
          <ShikiSourceView content={rawText} fileName={fileName} language="ini" />
        )}
      </div>
    </div>
  );
}
