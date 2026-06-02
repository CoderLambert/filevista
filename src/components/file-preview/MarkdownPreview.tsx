"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "@/lib/shiki";
import { Copy, Check, Eye, Code2 } from "lucide-react";

interface MarkdownPreviewProps {
  content: string;
}

type ViewMode = "preview" | "source";

/**
 * Extract text content from React children recursively.
 */
function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (React.isValidElement(node) && node.props.children) {
    return getTextContent(node.props.children);
  }
  return "";
}

function ShikiPreBlock({ children, ...rest }: React.HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  const childArray = React.Children.toArray(children);
  const codeElement = childArray.find(
    (child) => React.isValidElement(child) && (child.type === "code" || (child.props as { className?: string })?.className?.includes("language-"))
  );

  const codeClassName = codeElement && React.isValidElement(codeElement)
    ? (codeElement.props as { className?: string })?.className || ""
    : "";
  const langMatch = /language-(\w+)/.exec(codeClassName);
  const language = langMatch ? langMatch[1] : "";

  const codeText = codeElement && React.isValidElement(codeElement)
    ? getTextContent(codeElement.props.children).replace(/\n$/, "")
    : getTextContent(children).replace(/\n$/, "");

  if (!language) {
    return <pre {...rest}>{children}</pre>;
  }

  return <ShikiPreContent key={`${language}:${codeText}`} code={codeText} language={language} />;
}

function ShikiPreContent({ code, language }: { code: string; language: string }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    highlightCode(code, language)
      .then((result) => {
        if (!cancelled && mountedRef.current) {
          setHtml(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[MarkdownPreview] Shiki highlight error:", err);
        if (!cancelled && mountedRef.current) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [code, language]);

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || error || !html) {
    return (
      <pre className="md-pre-loading">
        <div className="md-pre-header">
          <span className="md-lang-badge">{language}</span>
        </div>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    );
  }

  return (
    <div className="md-code-block group relative not-prose">
      <style dangerouslySetInnerHTML={{ __html: SHIKI_CODE_BLOCK_STYLES }} />
      <div className="md-pre-header">
        <span className="md-lang-badge">{language}</span>
        <button onClick={handleCopy} className="md-copy-btn" title="Copy code">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          )}
        </button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ── Source View: renders raw markdown with Shiki ──
function MarkdownSourceView({ content }: { content: string }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);

  const lineCount = useMemo(() => content.split("\n").length, [content]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    highlightCode(content, "markdown")
      .then((result) => {
        if (!cancelled && mountedRef.current) {
          setHtml(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[MarkdownSourceView] Shiki highlight error:", err);
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [content]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
            md
          </span>
          <span className="text-xs text-muted-foreground">
            {lineCount} line{lineCount !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          title="Copy source"
        >
          {copied ? (
            <Check size={14} className="text-green-500" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <style dangerouslySetInnerHTML={{ __html: SOURCE_SHIKI_STYLES }} />

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
            className="md-source-wrapper shiki-wrap"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="shiki-plaintext">
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

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const components = useMemo(() => ({ pre: ShikiPreBlock }), []);

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

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {viewMode === "preview" ? (
          <div className="markdown-preview">
            <article className="prose prose-sm dark:prose-invert max-w-none px-6 py-5 sm:px-8 sm:py-6
              prose-headings:scroll-mt-20
              prose-h1:text-2xl prose-h1:font-extrabold prose-h1:tracking-tight
              prose-h2:text-xl prose-h2:font-bold prose-h2:tracking-tight
              prose-h3:text-lg prose-h3:font-semibold
              prose-h4:text-base prose-h4:font-semibold
              prose-a:font-medium prose-a:underline-offset-2
              prose-code:before:content-none prose-code:after:content-none
              prose-code:font-semibold prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-primary
              prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0
              prose-th:text-left
              prose-img:rounded-lg
              prose-blockquote:border-l-4 prose-blockquote:italic
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <MarkdownSourceView content={content} />
        )}
      </div>
    </div>
  );
}

// ── Shiki Code Block Styles (within prose) ──
// Only the code-block-specific styles that prose doesn't provide.
// The `not-prose` class on .md-code-block prevents prose from overriding these.
const SHIKI_CODE_BLOCK_STYLES = `
.md-code-block {
  margin: 1.5em 0;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
}

.md-pre-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
  background: var(--color-muted, rgba(0, 0, 0, 0.03));
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
}
.md-lang-badge {
  font-size: 0.6875rem;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  padding: 0.1em 0.5em;
  border-radius: 0.25rem;
  background: var(--color-muted, rgba(0, 0, 0, 0.06));
  opacity: 0.75;
  font-weight: 500;
}
.md-copy-btn {
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: inherit;
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  cursor: pointer;
}
.md-code-block:hover .md-copy-btn,
.md-code-block .md-copy-btn:focus {
  opacity: 0.5;
}
.md-copy-btn:hover {
  opacity: 1 !important;
  background: var(--color-muted, rgba(0, 0, 0, 0.06));
}

.md-pre-loading {
  margin: 1.5em 0;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  overflow-x: auto;
  tab-size: 2;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
  background: var(--color-muted, rgba(0, 0, 0, 0.02));
}

.md-code-block pre {
  margin: 0 !important;
  padding: 1rem 1.25rem !important;
  font-size: 0.8125rem !important;
  line-height: 1.7 !important;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace) !important;
  overflow-x: auto;
  tab-size: 2;
}

/* ── Dual-theme CSS variable switching ── */
.md-code-block .shiki {
  background-color: var(--shiki-light-bg, #f6f8fa) !important;
  color: var(--shiki-light, #24292e) !important;
}
.md-code-block .shiki span {
  color: var(--shiki-light) !important;
  background-color: var(--shiki-light-bg, transparent) !important;
}
.dark .md-code-block .shiki,
html.dark .md-code-block .shiki {
  background-color: var(--shiki-dark-bg, #24292e) !important;
  color: var(--shiki-dark, #e1e4e8) !important;
}
.dark .md-code-block .shiki span,
html.dark .md-code-block .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg, transparent) !important;
}
@media (prefers-color-scheme: dark) {
  :root:not(:has(.light)) .md-code-block .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  :root:not(:has(.light)) .md-code-block .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
}

/* ── Line numbers ── */
.md-code-block .shiki .line {
  min-height: 1.7em;
  padding-left: 3.5em;
  position: relative;
  display: inline-block;
  width: 100%;
}
.md-code-block .shiki .line::before {
  content: attr(data-line);
  position: absolute;
  left: 0;
  width: 2.5em;
  text-align: right;
  opacity: 0.3;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
`;

// ── Source view Shiki styles (reuse same pattern as CodePreview) ──
const SOURCE_SHIKI_STYLES = `
  /* ── Base wrapper ── */
  .md-source-wrapper pre {
    margin: 0 !important;
    padding: 1rem 1.5rem !important;
    font-size: 0.8125rem !important;
    line-height: 1.7 !important;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace !important;
    overflow-x: auto;
    tab-size: 2;
  }

  /* ── Word wrap ── */
  .md-source-wrapper.shiki-wrap pre { white-space: pre-wrap !important; word-break: break-word !important; }
  .md-source-wrapper.shiki-wrap .line { white-space: pre-wrap; word-break: break-word; }

  /* ── Line numbers ── */
  .md-source-wrapper .line {
    min-height: 1.7em;
    padding-left: 3.5em;
    position: relative;
    display: inline-block;
    width: 100%;
  }
  .md-source-wrapper .line::before {
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
  .md-source-wrapper .shiki {
    background-color: var(--shiki-light-bg, #fff) !important;
    color: var(--shiki-light, #24292e) !important;
  }
  .md-source-wrapper .shiki span {
    color: var(--shiki-light) !important;
    background-color: var(--shiki-light-bg, transparent) !important;
  }
  .dark .md-source-wrapper .shiki,
  html.dark .md-source-wrapper .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  .dark .md-source-wrapper .shiki span,
  html.dark .md-source-wrapper .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
  @media (prefers-color-scheme: dark) {
    :root:not(:has(.light)) .md-source-wrapper .shiki {
      background-color: var(--shiki-dark-bg, #24292e) !important;
      color: var(--shiki-dark, #e1e4e8) !important;
    }
    :root:not(:has(.light)) .md-source-wrapper .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
  }

  /* ── Plain text fallback ── */
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
