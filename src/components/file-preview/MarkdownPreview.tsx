import React, { useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "./shiki";
import { EyeIcon, Code2Icon } from "./icons";
import { ShikiSourceView } from "./ShikiSourceView";
import { FILE_PREVIEW_LIMITS } from "./limits";
import "./styles/MarkdownPreview.css";
import "./styles/ViewModeBar.css";

interface MarkdownPreviewProps {
  content: string;
}

type ViewMode = "preview" | "source";

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props.children) return getTextContent(props.children);
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
    ? getTextContent((codeElement.props as { children?: ReactNode }).children).replace(/\n$/, "")
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

    if (code.length > FILE_PREVIEW_LIMITS.SHIKI_MAX_CODE_BLOCK_SIZE) {
      queueMicrotask(() => {
        if (mountedRef.current) {
          setLoading(false);
          setHtml("");
        }
      });
      return;
    }

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

  const isOversized = code.length > FILE_PREVIEW_LIMITS.SHIKI_MAX_CODE_BLOCK_SIZE;

  if (loading || error || (!html && !isOversized)) {
    return (
      <pre className="md-pre-loading">
        <div className="md-pre-header">
          <span className="md-lang-badge">{language}</span>
        </div>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    );
  }

  if (isOversized) {
    return (
      <pre className="md-pre-loading">
        <div className="md-pre-header">
          <span className="md-lang-badge">{language}</span>
          <span className="md-lang-badge" style={{ fontSize: "0.6em", opacity: 0.7 }}>大代码块</span>
        </div>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    );
  }

  return (
    <div className="md-code-block">
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
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const components = useMemo(() => ({ pre: ShikiPreBlock }), []);

  return (
    <div className="fv-markdown">
      <div className="fv-view-mode-bar">
        <div className="fv-view-mode-group">
          <button
            onClick={() => setViewMode("preview")}
            className={`fv-view-mode-btn ${viewMode === "preview" ? "fv-view-mode-btn--active" : ""}`}
          >
            <EyeIcon size={13} />
            预览
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={`fv-view-mode-btn ${viewMode === "source" ? "fv-view-mode-btn--active" : ""}`}
          >
            <Code2Icon size={13} />
            源码
          </button>
        </div>
      </div>

      <div className="fv-markdown__content">
        {viewMode === "preview" ? (
          <div className="fv-markdown__preview">
            <article className="fv-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <ShikiSourceView content={content} fileName="markdown.md" language="markdown" />
        )}
      </div>
    </div>
  );
}
