"use client";

import React, { useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "@/lib/shiki";

interface MarkdownPreviewProps {
  content: string;
}

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
    <div className="md-code-block group relative">
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

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const components = useMemo(() => ({ pre: ShikiPreBlock }), []);

  return (
    <div className="markdown-preview md-prose">
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_PROSE_STYLES }} />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Complete Markdown Prose + Shiki Styles ──
// Uses explicit rgba colors instead of var(--color-border) for visibility
// (the CSS variable resolves too light in bright mode)
const MARKDOWN_PROSE_STYLES = `
/* ══════════════════════════════════════════════════
   Markdown Prose Typography — self-contained
   ══════════════════════════════════════════════════ */

.md-prose {
  font-size: 0.875rem;
  line-height: 1.75;
  max-width: none;
  padding: 1.5rem 2rem;
  color: var(--color-foreground);
}

/* ── Headings ── */
.md-prose :where(h1, h2, h3, h4, h5, h6) {
  color: var(--color-foreground);
}
.md-prose h1 {
  font-size: 2.25em;
  font-weight: 800;
  margin-top: 0;
  margin-bottom: 0.8em;
  line-height: 1.1;
  letter-spacing: -0.025em;
}
.md-prose h2 {
  font-size: 1.5em;
  font-weight: 700;
  margin-top: 2em;
  margin-bottom: 0.6em;
  line-height: 1.3;
  letter-spacing: -0.02em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
.md-prose h3 {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1.6em;
  margin-bottom: 0.5em;
  line-height: 1.4;
}
.md-prose h4 {
  font-size: 1.1em;
  font-weight: 600;
  margin-top: 1.4em;
  margin-bottom: 0.4em;
}
.md-prose h5, .md-prose h6 {
  font-size: 1em;
  font-weight: 600;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
}
.md-prose h6 {
  color: var(--color-muted-foreground);
}

/* ── Paragraph ── */
.md-prose p {
  margin-top: 1.25em;
  margin-bottom: 1.25em;
}

/* ── Links ── */
.md-prose a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 500;
}
.md-prose a:hover {
  opacity: 0.8;
}

/* ── Strong / Em ── */
.md-prose strong {
  font-weight: 700;
}
.md-prose em {
  font-style: italic;
}

/* ── Horizontal Rule ── */
.md-prose hr {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 2em 0;
}

/* ── Lists ── */
.md-prose ul {
  list-style-type: disc;
  margin-top: 1.25em;
  margin-bottom: 1.25em;
  padding-left: 1.625em;
}
.md-prose ol {
  list-style-type: decimal;
  margin-top: 1.25em;
  margin-bottom: 1.25em;
  padding-left: 1.625em;
}
.md-prose li {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.md-prose li::marker {
  color: var(--color-muted-foreground);
}
.md-prose li > ul,
.md-prose li > ol {
  margin-top: 0.3em;
  margin-bottom: 0.3em;
}

/* ── Task Lists (GFM) ── */
.md-prose ul:has(> li > input[type="checkbox"]) {
  list-style-type: none;
  padding-left: 0.25em;
}
.md-prose li > input[type="checkbox"] {
  margin-right: 0.5em;
  accent-color: var(--color-primary);
  transform: scale(1.1);
  vertical-align: middle;
}

/* ── Blockquote ── */
.md-prose blockquote {
  border-left: 4px solid rgba(0, 0, 0, 0.15);
  padding: 0.5em 0 0.5em 1em;
  margin: 1.5em 0;
  color: var(--color-muted-foreground);
  font-style: italic;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0 0.375rem 0.375rem 0;
}
.md-prose blockquote p:first-child {
  margin-top: 0.25em;
}
.md-prose blockquote p:last-child {
  margin-bottom: 0.25em;
}

/* ── Inline Code ── */
.md-prose code:not(pre code) {
  font-size: 0.875em;
  font-weight: 600;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-primary);
}

/* ── Plain Pre (no language) ── */
.md-prose pre:not(.md-pre-loading):not(.md-code-block pre) {
  margin: 1.5em 0;
  padding: 1rem 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  overflow-x: auto;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.04);
}

/* ── Table ── */
.md-prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.875em;
}
.md-prose th {
  font-weight: 600;
  text-align: left;
  padding: 0.5em 0.75em;
  border-bottom: 2px solid rgba(0, 0, 0, 0.12);
}
.md-prose td {
  padding: 0.5em 0.75em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.md-prose tr:last-child td {
  border-bottom: none;
}
.md-prose th:first-child,
.md-prose td:first-child {
  padding-left: 0;
}
.md-prose th:last-child,
.md-prose td:last-child {
  padding-right: 0;
}
.md-prose tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

/* ── Images ── */
.md-prose img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1.5em 0;
}

/* ══════════════════════════════════════════════════
   Shiki Code Block Styles
   ══════════════════════════════════════════════════ */

.md-prose .md-code-block {
  margin: 1.5em 0;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.md-prose .md-pre-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.md-prose .md-lang-badge {
  font-size: 0.6875rem;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  padding: 0.1em 0.5em;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.06);
  opacity: 0.75;
  font-weight: 500;
}
.md-prose .md-copy-btn {
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: inherit;
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  cursor: pointer;
}
.md-prose .md-code-block:hover .md-copy-btn,
.md-prose .md-code-block .md-copy-btn:focus {
  opacity: 0.5;
}
.md-prose .md-copy-btn:hover {
  opacity: 1 !important;
  background: rgba(0, 0, 0, 0.06);
}

.md-prose .md-pre-loading {
  margin: 1.5em 0;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
  overflow-x: auto;
  tab-size: 2;
  border-radius: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

.md-prose .md-code-block pre {
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
.md-prose .md-code-block .shiki {
  background-color: var(--shiki-light-bg, #f6f8fa) !important;
  color: var(--shiki-light, #24292e) !important;
}
.md-prose .md-code-block .shiki span {
  color: var(--shiki-light) !important;
  background-color: var(--shiki-light-bg, transparent) !important;
}
.dark .md-prose .md-code-block .shiki,
html.dark .md-prose .md-code-block .shiki {
  background-color: var(--shiki-dark-bg, #24292e) !important;
  color: var(--shiki-dark, #e1e4e8) !important;
}
.dark .md-prose .md-code-block .shiki span,
html.dark .md-prose .md-code-block .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg, transparent) !important;
}
@media (prefers-color-scheme: dark) {
  :root:not(:has(.light)) .md-prose .md-code-block .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  :root:not(:has(.light)) .md-prose .md-code-block .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
}

/* ── Line numbers ── */
.md-prose .md-code-block .shiki .line {
  min-height: 1.7em;
  padding-left: 3.5em;
  position: relative;
  display: inline-block;
  width: 100%;
}
.md-prose .md-code-block .shiki .line::before {
  content: attr(data-line);
  position: absolute;
  left: 0;
  width: 2.5em;
  text-align: right;
  opacity: 0.3;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

/* ══════════════════════════════════════════════════
   Dark mode — invert rgba polarities
   ══════════════════════════════════════════════════ */
.dark .md-prose h2 {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
.dark .md-prose hr {
  border-top-color: rgba(255, 255, 255, 0.1);
}
.dark .md-prose blockquote {
  border-left-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
}
.dark .md-prose code:not(pre code) {
  background: rgba(255, 255, 255, 0.08);
}
.dark .md-prose pre:not(.md-pre-loading):not(.md-code-block pre) {
  background: rgba(255, 255, 255, 0.04);
}
.dark .md-prose th {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
.dark .md-prose td {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}
.dark .md-prose tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
.dark .md-prose .md-code-block {
  border-color: rgba(255, 255, 255, 0.08);
}
.dark .md-prose .md-pre-header {
  background: rgba(255, 255, 255, 0.04);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.dark .md-prose .md-lang-badge {
  background: rgba(255, 255, 255, 0.1);
}
.dark .md-prose .md-copy-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
.dark .md-prose .md-pre-loading {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}
`;
