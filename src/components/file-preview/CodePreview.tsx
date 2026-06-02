"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Copy, Check, WrapText } from "lucide-react";
import { highlightCode as shikiHighlight, getShikiLanguage } from "@/lib/shiki";
import { shouldHighlight } from "./limits";
import { PlainTextLargePreview } from "./PlainTextLargePreview";

interface CodePreviewProps {
  content: string;
  fileName: string;
  isJson?: boolean;
}

export function CodePreview({ content, fileName, isJson }: CodePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const mountedRef = useRef(true);

  const language = useMemo(
    () => (isJson ? "json" : getShikiLanguage(fileName)),
    [isJson, fileName]
  );

  // Format JSON if needed
  const displayContent = useMemo(() => {
    if (isJson) {
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    }
    return content;
  }, [content, isJson]);

  // Line count for display
  const lineCount = useMemo(
    () => displayContent.split("\n").length,
    [displayContent]
  );

  const doHighlight = useCallback(async () => {
    if (!shouldHighlight(displayContent)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const result = await shikiHighlight(displayContent, language);

      if (mountedRef.current) {
        setHtml(result);
      }
    } catch (err) {
      console.error("[CodePreview] Shiki highlight error:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Highlight failed");
        setHtml("");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [displayContent, language]);

  useEffect(() => {
    mountedRef.current = true;
    doHighlight();
    return () => {
      mountedRef.current = false;
    };
  }, [doHighlight]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
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

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        {/* Dual-theme CSS variable switching + line number styles */}
        <style dangerouslySetInnerHTML={{ __html: SHIKI_STYLES }} />

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
            className={`shiki-wrapper ${wordWrap ? "shiki-wrap" : "shiki-nowrap"}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : !shouldHighlight(displayContent) ? (
          <PlainTextLargePreview content={displayContent} language={language} />
        ) : (
          // Fallback: plain text with line numbers
          <div className="shiki-plaintext">
            <pre>
              <code>
                {displayContent.split("\n").map((line, i) => (
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
const SHIKI_STYLES = `
  /* ── Base wrapper ── */
  .shiki-wrapper pre {
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
  .shiki-wrap pre { white-space: pre-wrap !important; word-break: break-word !important; }
  .shiki-wrap .line { white-space: pre-wrap; word-break: break-word; }
  .shiki-nowrap pre { white-space: pre !important; }
  .shiki-nowrap .line { white-space: pre; }

  /* ── Line numbers (via data-line attribute from transformer) ── */
  .shiki-wrapper .line {
    min-height: 1.7em;
    padding-left: 3.5em;
    position: relative;
    display: inline-block;
    width: 100%;
  }
  .shiki-wrapper .line::before {
    content: attr(data-line);
    position: absolute;
    left: 0;
    width: 2.5em;
    text-align: right;
    opacity: 0.3;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }

  /* ── Dual theme switching via CSS variables ── */
  /* Light mode (default) */
  .shiki-wrapper .shiki {
    background-color: var(--shiki-light-bg, #fff) !important;
    color: var(--shiki-light, #24292e) !important;
  }
  .shiki-wrapper .shiki span {
    color: var(--shiki-light) !important;
    background-color: var(--shiki-light-bg, transparent) !important;
  }

  /* Dark mode */
  .dark .shiki-wrapper .shiki,
  html.dark .shiki-wrapper .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  .dark .shiki-wrapper .shiki span,
  html.dark .shiki-wrapper .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }

  @media (prefers-color-scheme: dark) {
    :root:not(:has(.light)) .shiki-wrapper .shiki {
      background-color: var(--shiki-dark-bg, #24292e) !important;
      color: var(--shiki-dark, #e1e4e8) !important;
    }
    :root:not(:has(.light)) .shiki-wrapper .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
  }

  /* ── Plain text fallback styles ── */
  .shiki-plaintext pre {
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
  .dark .shiki-plaintext pre {
    background-color: #1b1f23;
    color: #e1e4e8;
  }
  .shiki-plaintext .line {
    display: flex;
    min-height: 1.7em;
  }
  .shiki-plaintext .linenumber {
    display: inline-block;
    width: 2.5em;
    text-align: right;
    padding-right: 1em;
    opacity: 0.3;
    user-select: none;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .shiki-plaintext .linecontent {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
