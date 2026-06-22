"use client";

import { useState, useEffect } from "react";
import { EyeIcon, Code2Icon } from "./icons";
import DOMPurify from "dompurify";
import { ShikiSourceView } from "./ShikiSourceView";
import { loadRtfJsGlobals } from "./rtf/load-rtfjs";
import { normalizeRtfCodepage } from "./rtf/normalize-codepage";
import { useLocale } from "./core/i18n";
import "./styles/RtfPreview.css";
import "./styles/ViewModeBar.css";

interface RtfPreviewProps {
  buffer: ArrayBuffer;
  rawText: string;
  fileName: string;
}

type ViewMode = "preview" | "source";

function extractRtfText(rtf: string): string[] {
  let text = rtf;
  let prev: string;
  do {
    prev = text;
    text = text.replace(/\{\\\*[^{}]*\}/g, "");
  } while (text !== prev);

  text = text.replace(
    /\{\\(?:fonttbl|colortbl|stylesheet|info|generator|listtable|listoverridetable|rsidtbl|datastore|themedata)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi,
    "",
  );

  text = text.replace(/\\par\b\s?/g, "\n");
  text = text.replace(/\\line\b\s?/g, "\n");
  text = text.replace(/\\tab\b\s?/g, "\t");

  text = text.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let code = parseInt(n, 10);
    if (code < 0) code += 65536;
    return String.fromCharCode(code);
  });

  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  text = text.replace(/\\([\\{}])/g, "$1");
  text = text.replace(/\\[a-z]+-?\d* ?/gi, "");
  text = text.replace(/\\[^a-zA-Z0-9]/g, "");
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\r\n?/g, "\n");

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function buildRtfHtml(
  buffer: ArrayBuffer,
): Promise<{ html: string | null; error: string | null }> {
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

    const container = document.createElement("div");
    for (const el of elements) {
      container.appendChild(el);
    }
    let rawHtml = container.innerHTML;
    rawHtml = rawHtml.replace(/undefined/g, "");

    if (!rawHtml.trim()) {
      return { html: null, error: "Parsed RTF produced no renderable content" };
    }

    const sanitized = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
      ALLOWED_ATTR: [
        "href", "src", "alt", "title", "width", "height",
        "colspan", "rowspan", "align", "valign", "border",
        "cellpadding", "cellspacing", "class", "style",
      ],
    });

    return { html: sanitized, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[FileVista][RTF] rich render failed, falling back to text:", message);
    return { html: null, error: message };
  }
}

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
    font-size: 15px; line-height: 1.7; color: #1f2937; background: #fff;
  }
  body { padding: 32px 40px; max-width: 860px; margin: 0 auto; }
  h1, h2, h3 { line-height: 1.3; font-weight: 600; color: #111827; }
  h1 { font-size: 1.75rem; margin: 1.4rem 0 0.9rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb; }
  h2 { font-size: 1.4rem; margin: 1.3rem 0 0.7rem; padding-bottom: 0.35rem; border-bottom: 1px solid #e5e7eb; }
  h3 { font-size: 1.15rem; margin: 1.1rem 0 0.55rem; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  p { margin: 0 0 0.8rem; } p:last-child { margin-bottom: 0; }
  strong, b { font-weight: 600; color: #111827; }
  em, i { font-style: italic; } u { text-decoration: underline; text-underline-offset: 2px; }
  s, strike, del { text-decoration: line-through; }
  table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  ul, ol { padding-left: 1.6rem; margin: 0 0 0.8rem; } li { margin-bottom: 0.25rem; }
  a { color: #2563eb; text-decoration: underline; }
  blockquote { border-left: 3px solid #d1d5db; padding: 0.25rem 0 0.25rem 1rem; margin: 0.8rem 0; color: #4b5563; }
  pre { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; margin: 0.8rem 0; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre code { background: none; padding: 0; }
  img, svg { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2rem 0; }
  body > div { margin: 0; }
  @media (prefers-color-scheme: dark) {
    html, body { color: #d1d5db; background: #111827; }
    h1, h2, h3 { color: #f3f4f6; } h1, h2 { border-color: #374151; }
    strong, b { color: #f9fafb; } th { background: #1f2937; } th, td { border-color: #374151; }
    pre, code { background: #1f2937; } blockquote { border-color: #4b5563; color: #9ca3af; }
    a { color: #60a5fa; } hr { border-color: #374151; }
  }
</style>
</head>
<body>${html}</body></html>`;
}

export function RtfPreview({ buffer, rawText, fileName }: RtfPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<"loading" | "done">("loading");
  const t = useLocale();

  useEffect(() => {
    let cancelled = false;
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

    return () => { cancelled = true; };
  }, [buffer]);

  return (
    <div className="fv-rtf">
      <div className="fv-rtf__topbar">
        <div className="fv-rtf__topbar-left">
          <span style={{ fontSize: 'var(--fv-font-size-sm)' }}>📃</span>
          <span className="fv-rtf__filename">{fileName}</span>
          <span className="fv-rtf__filetype">RTF</span>
        </div>
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
      </div>

      <div className="fv-rtf__content">
        {viewMode === "preview" ? (
          renderState === "loading" ? (
            <div className="fv-rtf__loading">{t.loadingRtf}</div>
          ) : iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              sandbox=""
              className="fv-rtf__iframe"
              title={`Preview of ${fileName}`}
            />
          ) : (
            <RtfTextFallback rawText={rawText} renderError={renderError} t={t} />
          )
        ) : (
          <ShikiSourceView content={rawText} fileName={fileName} language="text" />
        )}
      </div>
    </div>
  );
}

function RtfTextFallback({
  rawText,
  renderError,
  t,
}: {
  rawText: string;
  renderError: string | null;
  t: ReturnType<typeof useLocale>;
}) {
  const paragraphs = extractRtfText(rawText);

  return (
    <div className="fv-rtf-text-fallback">
      <div className="fv-rtf-text-fallback__inner">
        <div className="fv-rtf-text-fallback__warn">
          <div className="fv-rtf-text-fallback__warn-header">
            <span style={{ fontSize: 'var(--fv-font-size-sm)' }}>⚠️</span>
            <span className="fv-rtf-text-fallback__warn-text">
              {t.rtfFallback}
            </span>
          </div>
          {renderError && (
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--fv-warning)', opacity: 0.7 }}>
                {t.showErrorDetails}
              </summary>
              <pre style={{ marginTop: '0.375rem', fontSize: '10px', color: 'var(--fv-warning)', opacity: 0.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {renderError}
              </pre>
            </details>
          )}
        </div>
        <div className="fv-rtf-text-fallback__paper">
          {paragraphs.map((para, i) => (
            <p key={i} className="fv-rtf-text-fallback__p">{para}</p>
          ))}
          {paragraphs.length === 0 && (
            <p style={{ color: 'var(--fv-muted-foreground)', fontSize: 'var(--fv-font-size-sm)' }}>
              {t.rtfNoText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
