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

/**
 * Shiki-powered code block renderer.
 *
 * - Detects language from the child <code> element's className (e.g. "language-typescript")
 * - Calls highlightCode() asynchronously (lazy loads Shiki + grammar on demand)
 * - Renders dual-theme CSS variable output (consistent with CodePreview)
 * - Falls back to plain <pre><code> while loading or on error
 *
 * Uses key={code+language} from parent to reset on prop changes (avoids setState in effect).
 */
function ShikiPreBlock({ children, ...rest }: React.HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  // Extract language from child <code> element's className
  const childArray = React.Children.toArray(children);
  const codeElement = childArray.find(
    (child) => React.isValidElement(child) && (child.type === "code" || (child.props as { className?: string })?.className?.includes("language-"))
  );

  const codeClassName = codeElement && React.isValidElement(codeElement)
    ? (codeElement.props as { className?: string })?.className || ""
    : "";
  const langMatch = /language-(\w+)/.exec(codeClassName);
  const language = langMatch ? langMatch[1] : "";

  // Get the raw code text
  const codeText = codeElement && React.isValidElement(codeElement)
    ? getTextContent(codeElement.props.children).replace(/\n$/, "")
    : getTextContent(children).replace(/\n$/, "");

  // If no language detected, render as plain pre
  if (!language) {
    return <pre {...rest}>{children}</pre>;
  }

  // Key forces remount when code/language changes — avoids setState-in-effect
  return <ShikiPreContent key={`${language}:${codeText}`} code={codeText} language={language} />;
}

/**
 * Async pre block: loads Shiki highlight and renders the result.
 *
 * Initial state is loading=true. Key changes from parent cause full remount
 * (fresh loading state) instead of setState-in-effect.
 */
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

  // Loading or error — render plain code block
  if (loading || error || !html) {
    return (
      <pre className="shiki-pre-loading">
        <div className="shiki-pre-header">
          <span className="shiki-lang-badge">{language}</span>
        </div>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    );
  }

  // Success — render Shiki highlighted HTML (already includes <pre><code>)
  return (
    <div className="shiki-code-block group relative">
      <div className="shiki-pre-header">
        <span className="shiki-lang-badge">{language}</span>
        <button
          onClick={handleCopy}
          className="shiki-copy-btn"
          title="Copy code"
        >
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
  // Memoize components to avoid re-creating on every render
  const components = useMemo(
    () => ({
      pre: ShikiPreBlock,
    }),
    []
  );

  return (
    <div className="markdown-preview prose prose-sm dark:prose-invert max-w-none p-6">
      {/* Dual-theme CSS for Shiki-highlighted code blocks inside Markdown */}
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_SHIKI_STYLES }} />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Styles for Shiki code blocks within Markdown ──
const MARKDOWN_SHIKI_STYLES = `
  /* ── Shiki code block wrapper ── */
  .markdown-preview .shiki-code-block {
    margin: 1em 0;
    border-radius: 0.5rem;
    overflow: hidden;
    position: relative;
  }

  /* ── Code block header (language badge + copy button) ── */
  .markdown-preview .shiki-pre-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.75rem;
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
  .dark .markdown-preview .shiki-pre-header {
    background: rgba(255, 255, 255, 0.04);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .markdown-preview .shiki-lang-badge {
    font-size: 0.6875rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    padding: 0.1em 0.5em;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.06);
    opacity: 0.7;
  }
  .dark .markdown-preview .shiki-lang-badge {
    background: rgba(255, 255, 255, 0.1);
  }

  .markdown-preview .shiki-copy-btn {
    padding: 0.25rem;
    border-radius: 0.25rem;
    color: inherit;
    opacity: 0;
    transition: opacity 0.15s;
    background: none;
    border: none;
    cursor: pointer;
  }
  .markdown-preview .shiki-code-block:hover .shiki-copy-btn,
  .markdown-preview .shiki-code-block .shiki-copy-btn:focus {
    opacity: 0.6;
  }
  .markdown-preview .shiki-copy-btn:hover {
    opacity: 1 !important;
    background: rgba(0, 0, 0, 0.06);
  }
  .dark .markdown-preview .shiki-copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ── Loading state pre ── */
  .markdown-preview .shiki-pre-loading {
    margin: 1em 0;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    line-height: 1.7;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    overflow-x: auto;
    tab-size: 2;
    border-radius: 0.5rem;
  }

  /* ── Shiki output styling ── */
  .markdown-preview .shiki-code-block pre {
    margin: 0 !important;
    padding: 1rem 1.25rem !important;
    font-size: 0.8125rem !important;
    line-height: 1.7 !important;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace !important;
    overflow-x: auto;
    tab-size: 2;
  }

  /* ── Dual-theme switching via CSS variables ── */
  .markdown-preview .shiki-code-block .shiki {
    background-color: var(--shiki-light-bg, #f6f8fa) !important;
    color: var(--shiki-light, #24292e) !important;
  }
  .markdown-preview .shiki-code-block .shiki span {
    color: var(--shiki-light) !important;
    background-color: var(--shiki-light-bg, transparent) !important;
  }

  .dark .markdown-preview .shiki-code-block .shiki,
  html.dark .markdown-preview .shiki-code-block .shiki {
    background-color: var(--shiki-dark-bg, #24292e) !important;
    color: var(--shiki-dark, #e1e4e8) !important;
  }
  .dark .markdown-preview .shiki-code-block .shiki span,
  html.dark .markdown-preview .shiki-code-block .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }

  @media (prefers-color-scheme: dark) {
    :root:not(:has(.light)) .markdown-preview .shiki-code-block .shiki {
      background-color: var(--shiki-dark-bg, #24292e) !important;
      color: var(--shiki-dark, #e1e4e8) !important;
    }
    :root:not(:has(.light)) .markdown-preview .shiki-code-block .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
  }

  /* ── Line numbers (via data-line from transformer) ── */
  .markdown-preview .shiki-code-block .shiki .line {
    min-height: 1.7em;
    padding-left: 3.5em;
    position: relative;
    display: inline-block;
    width: 100%;
  }
  .markdown-preview .shiki-code-block .shiki .line::before {
    content: attr(data-line);
    position: absolute;
    left: 0;
    width: 2.5em;
    text-align: right;
    opacity: 0.3;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }

  /* ── Inline code (no language) ── */
  .markdown-preview code:not(pre code) {
    font-size: 0.85em;
    padding: 0.15em 0.4em;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  /* ── Override prose pre styles for Shiki blocks ── */
  .markdown-preview .shiki-code-block + pre,
  .markdown-preview pre + .shiki-code-block {
    margin-top: 0;
  }
`;
