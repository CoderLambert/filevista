"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Copy, Check, WrapText } from "lucide-react";
import { highlightCode, getShikiLanguage } from "@/lib/shiki";

interface ShikiSourceViewProps {
  content: string;
  fileName: string;
  /** Override language detection (e.g. "html", "xml", "ini") */
  language?: string;
  /** Show toolbar with language badge, line count, copy, wrap toggle. Default: true */
  showToolbar?: boolean;
}

export function ShikiSourceView({
  content,
  fileName,
  language: languageOverride,
  showToolbar = true,
}: ShikiSourceViewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const mountedRef = useRef(true);

  const language = useMemo(
    () => languageOverride || getShikiLanguage(fileName),
    [languageOverride, fileName]
  );

  const lineCount = useMemo(
    () => content.split("\n").length,
    [content]
  );

  const doHighlight = useCallback(async () => {
    try {
      setLoading(true);
      const result = await highlightCode(content, language);
      if (mountedRef.current) {
        setHtml(result);
      }
    } catch (err) {
      console.warn("[ShikiSourceView] highlight error:", err);
      if (mountedRef.current) {
        setHtml("");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [content, language]);

  useEffect(() => {
    mountedRef.current = true;
    doHighlight();
    return () => {
      mountedRef.current = false;
    };
  }, [doHighlight]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
              {language}
            </span>
            <span className="text-xs text-muted-foreground">
              {lineCount} line{lineCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWordWrap((w) => !w)}
              className={`p-1.5 rounded-md transition-colors ${
                wordWrap
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
            >
              <WrapText size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              title="Copy code"
            >
              {copied ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <style dangerouslySetInnerHTML={{ __html: SHIKI_SOURCE_STYLES }} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <p className="text-xs text-muted-foreground">
                Loading syntax highlighter...
              </p>
            </div>
          </div>
        ) : html ? (
          <div
            className={`shiki-source-wrapper ${wordWrap ? "shiki-source-wrap" : "shiki-source-nowrap"}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="shiki-source-plaintext">
            <pre>
              <code>
                {content.split("\n").map((line, i) => (
                  <div key={i} className="line">
                    <span className="linenumber">{i + 1}</span>
                    <span className="linecontent">{line || "\u00A0"}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles for Shiki dual-theme rendering + line numbers ──
// Scoped with .shiki-source-* prefix to avoid collision with other Shiki contexts
const SHIKI_SOURCE_STYLES = `
  /* ── Base wrapper ── */
  .shiki-source-wrapper pre {
    margin: 0 !important;
    padding: 1rem 1.5rem !important;
    font-size: 0.8125rem !important;
    line-height: 1.7 !important;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace !important;
    overflow-x: auto;
    tab-size: 2;
  }

  /* ── Word wrap / nowrap ── */
  .shiki-source-wrap pre { white-space: pre-wrap !important; word-break: break-word !important; }
  .shiki-source-wrap .line { white-space: pre-wrap; word-break: break-word; }
  .shiki-source-nowrap pre { white-space: pre !important; }
  .shiki-source-nowrap .line { white-space: pre; }

  /* ── Line numbers ── */
  .shiki-source-wrapper .line {
    min-height: 1.7em;
    padding-left: 3.5em;
    position: relative;
    display: inline-block;
    width: 100%;
  }
  .shiki-source-wrapper .line::before {
    content: attr(data-line);
    position: absolute;
    left: 0;
    width: 2.5em;
    text-align: right;
    opacity: 0.3;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }

  /* ── Dual theme switching ── */
  .shiki-source-wrapper .shiki {
    background-color: var(--shiki-light-bg, #fff) !important;
    color: var(--shiki-light, #24292e) !important;
  }
  .shiki-source-wrapper .shiki span {
    color: var(--shiki-light) !important;
    background-color: var(--shiki-light-bg, transparent) !important;
  }
  .dark .shiki-source-wrapper .shiki,
  html.dark .shiki-source-wrapper .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  .dark .shiki-source-wrapper .shiki span,
  html.dark .shiki-source-wrapper .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
  @media (prefers-color-scheme: dark) {
    :root:not(:has(.light)) .shiki-source-wrapper .shiki {
      background-color: var(--shiki-dark-bg, #24292e) !important;
      color: var(--shiki-dark, #e1e4e8) !important;
    }
    :root:not(:has(.light)) .shiki-source-wrapper .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
  }

  /* ── Plain text fallback ── */
  .shiki-source-plaintext pre {
    margin: 0;
    padding: 1rem 1.5rem;
    font-size: 0.8125rem;
    line-height: 1.7;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace;
    background-color: #f6f8fa;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .dark .shiki-source-plaintext pre {
    background-color: #1b1f23;
    color: #e1e4e8;
  }
  .shiki-source-plaintext .line {
    display: flex;
    min-height: 1.7em;
  }
  .shiki-source-plaintext .linenumber {
    display: inline-block;
    width: 2.5em;
    text-align: right;
    padding-right: 1em;
    opacity: 0.3;
    user-select: none;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .shiki-source-plaintext .linecontent {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
