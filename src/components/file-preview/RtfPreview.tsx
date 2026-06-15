"use client";

import { useState, useEffect } from "react";
import { Eye, Code2 } from "lucide-react";
import DOMPurify from "dompurify";
import { ShikiSourceView } from "./ShikiSourceView";
import { loadRtfJsGlobals } from "./rtf/load-rtfjs";
import { normalizeRtfCodepage } from "./rtf/normalize-codepage";

interface RtfPreviewProps {
  /** Original RTF bytes (ArrayBuffer) — must not be re-encoded. */
  buffer: ArrayBuffer;
  /** Raw RTF text string (for source view + text-extraction fallback). */
  rawText: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

// ── RTF text extraction (fallback for unparseable RTF) ──

/**
 * Strip RTF control codes to extract plain-text paragraphs.
 *
 * Used as the last-resort fallback when rtf.js can't render. Handles the
 * common cases (control words, hex escapes, `\u` Unicode, nested optional-
 * destination groups) but is intentionally lenient — we'd rather show
 * messy text than nothing.
 */
function extractRtfText(rtf: string): string[] {
  let text = rtf;

  // Recursively strip optional-destination groups ({\*\xxx ...}) — they nest.
  let prev: string;
  do {
    prev = text;
    text = text.replace(/\{\\\*[^{}]*\}/g, "");
  } while (text !== prev);

  // Strip well-known metadata groups.
  text = text.replace(
    /\{\\(?:fonttbl|colortbl|stylesheet|info|generator|listtable|listoverridetable|rsidtbl|datastore|themedata)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi,
    "",
  );

  // Convert paragraph / line breaks to newlines BEFORE stripping control words.
  text = text.replace(/\\par\b\s?/g, "\n");
  text = text.replace(/\\line\b\s?/g, "\n");
  text = text.replace(/\\tab\b\s?/g, "\t");

  // Decode \uN[?] Unicode escapes — N is a signed 16-bit decimal.
  text = text.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let code = parseInt(n, 10);
    if (code < 0) code += 65536;
    return String.fromCharCode(code);
  });

  // Decode \'XX hex escapes (Latin-1 best-effort).
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  // Escaped literals — must come before generic control-word stripping.
  text = text.replace(/\\([\\{}])/g, "$1");

  // Drop remaining control words (\word optionally followed by a number).
  text = text.replace(/\\[a-z]+-?\d* ?/gi, "");

  // Drop control symbols (\~ \- \_ etc.).
  text = text.replace(/\\[^a-zA-Z0-9]/g, "");

  // Drop remaining group braces.
  text = text.replace(/[{}]/g, "");

  text = text.replace(/\r\n?/g, "\n");

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── RTF → HTML via rtf.js bundle + DOMPurify ──

/**
 * Convert RTF ArrayBuffer to sanitized HTML string.
 *
 * Pipeline:
 *   1. Header guard — bail out early on non-RTF input with a clear msg.
 *   2. rtf.js parses the RTF bytes and returns rendered DOM elements
 *      (including WMF/EMF images as inline `<svg>`).
 *   3. We serialize those nodes to an HTML string.
 *   4. DOMPurify sanitizes against XSS — rtf.js itself never produces
 *      scripts, but the documents are user-supplied.
 *
 * @returns `{ html }` on success, or `{ error }` on parser failure / empty
 *   output — caller falls back to plain-text extraction in that case.
 */
async function buildRtfHtml(
  buffer: ArrayBuffer,
): Promise<{ html: string | null; error: string | null }> {
  // Header guard — RTF streams must start with `{\rtf`. rtf.js's error in
  // this case is opaque ("Cannot parse"); a sniff up front is cheaper and
  // gives the user a meaningful message.
  const head = new TextDecoder("ascii", { fatal: false }).decode(
    buffer.slice(0, 16),
  );
  if (!head.trimStart().startsWith("{\\rtf")) {
    return {
      html: null,
      error: "Not a valid RTF stream (missing {\\rtf header)",
    };
  }

  try {
    const { RTFJS } = await loadRtfJsGlobals();

    // Workaround: rtf.js defaults to Windows-1252 when a document declares
    // only `\rtf1\ansi` without `\ansicpgN`. Many CJK files carry the
    // codepage information *only* in their font table (`\fcharset134` etc.),
    // and rtf.js's per-font codepage lookup happens late — by then primary-
    // text decoding has already been done in 1252. Pre-inject `\ansicpgN`
    // so rtf.js picks the right table from the start.
    const { bytes, injectedCodepage } = normalizeRtfCodepage(buffer);
    if (injectedCodepage !== null) {
      console.info(
        `[FileVista][RTF] no \\ansicpg in source — inferred cp${injectedCodepage} from \\fcharset`,
      );
    }

    const doc = new RTFJS.Document(bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer, {});
    const elements = await doc.render();

    // Serialize rendered nodes to an HTML string.
    const container = document.createElement("div");
    for (const el of elements) {
      container.appendChild(el);
    }
    let rawHtml = container.innerHTML;

    // Workaround: rtf.js emits the literal string "undefined" when it
    // encounters a `\dbch` (double-byte character set) reference in list
    // number placeholders (`\pntxta` / `\pntxtb`) — the renderer can't
    // resolve the double-byte font and falls through to
    // `String(undefined)`. This produces garbage like "PundefinedV" in
    // Big5 / GBK documents. Strip it from the output.
    rawHtml = rawHtml.replace(/undefined/g, "");

    if (!rawHtml.trim()) {
      return { html: null, error: "Parsed RTF produced no renderable content" };
    }

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
    // Expected: rtf.js throws on RTFs from non-Word producers (Apple Pages,
    // TextEdit, LibreOffice) with "Cannot route text to destination" or
    // similar. The caller falls back to plain-text extraction, so log at
    // `warn` to keep Next.js's dev overlay quiet.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[FileVista][RTF] rich render failed, falling back to text:", message);
    return { html: null, error: message };
  }
}

/**
 * Build a complete HTML document suitable for iframe srcDoc.
 * Injects base styles and the sanitized content.
 *
 * The CSS covers the full set of elements rtf.js can emit: paragraphs,
 * tables, lists, images (incl. inline `<svg>` for WMF/EMF), inline
 * formatting, and code blocks. Both light and dark schemes are styled.
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
  strong, b { font-weight: 600; color: #111827; }
  em, i { font-style: italic; }
  u { text-decoration: underline; text-underline-offset: 2px; }
  s, strike, del { text-decoration: line-through; }
  table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  ul, ol { padding-left: 1.6rem; margin: 0 0 0.8rem; }
  li { margin-bottom: 0.25rem; }
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
  img, svg { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2rem 0; }
  /* rtf.js wraps top-level content in a div with empty inline styles —
     unset margins so its container doesn't add stray spacing. */
  body > div { margin: 0; }
  @media (prefers-color-scheme: dark) {
    html, body { color: #d1d5db; background: #111827; }
    h1, h2, h3 { color: #f3f4f6; }
    h1, h2 { border-color: #374151; }
    strong, b { color: #f9fafb; }
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

export function RtfPreview({ buffer, rawText, fileName }: RtfPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<"loading" | "done">("loading");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderState("loading");

    buildRtfHtml(buffer).then((result) => {
      if (cancelled) return;
      if (result.html !== null) {
        setIframeHtml(buildIframeDoc(result.html));
        setRenderError(null);
      } else {
        setIframeHtml(null);
        setRenderError(result.error);
      }
      setRenderState("done");
    });

    return () => {
      cancelled = true;
    };
  }, [buffer]);

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
          renderState === "loading" ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              正在解析 RTF...
            </div>
          ) : iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              sandbox=""
              className="w-full h-full border-0"
              title={`Preview of ${fileName}`}
            />
          ) : (
            <RtfTextFallback rawText={rawText} renderError={renderError} />
          )
        ) : (
          <ShikiSourceView content={rawText} fileName={fileName} language="text" />
        )}
      </div>
    </div>
  );
}

// ── Plain-text fallback view ──

function RtfTextFallback({
  rawText,
  renderError,
}: {
  rawText: string;
  renderError: string | null;
}) {
  // Compute paragraphs lazily here, not in the parent — the rich path
  // never needs them.
  const paragraphs = extractRtfText(rawText);

  return (
    <div className="overflow-auto h-full p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="text-sm">⚠️</span>
            <span className="text-xs font-medium">
              富文本渲染不可用，已降级为纯文本预览
            </span>
          </div>
          {renderError && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-amber-600/80 dark:text-amber-400/70 hover:text-amber-700 dark:hover:text-amber-400">
                查看错误详情
              </summary>
              <pre className="mt-1.5 text-[10px] text-amber-700/80 dark:text-amber-400/70 whitespace-pre-wrap break-all">
                {renderError}
              </pre>
            </details>
          )}
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
  );
}
