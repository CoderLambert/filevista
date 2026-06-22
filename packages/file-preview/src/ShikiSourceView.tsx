"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CopyIcon, CheckIcon, WrapTextIcon } from "./icons";
import { highlightCode, getShikiLanguage } from "./shiki";
import { shouldHighlight } from "./limits";
import { PlainTextLargePreview } from "./PlainTextLargePreview";
import { useLocale } from "./core/i18n";
import "./styles/ShikiSourceView.css";

interface ShikiSourceViewProps {
  content: string;
  fileName: string;
  language?: string;
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
  const t = useLocale();

  const language = useMemo(
    () => languageOverride || getShikiLanguage(fileName),
    [languageOverride, fileName]
  );

  const lineCount = useMemo(
    () => content.split("\n").length,
    [content]
  );

  const canHighlight = useMemo(() => shouldHighlight(content), [content]);

  const [prevDeps, setPrevDeps] = useState({ content, language });
  if (prevDeps.content !== content || prevDeps.language !== language) {
    setPrevDeps({ content, language });
    setHtml("");
    setLoading(canHighlight);
  }

  useEffect(() => {
    if (!canHighlight) return;

    let cancelled = false;
    highlightCode(content, language).then(
      (result) => {
        if (cancelled) return;
        setHtml(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.warn("[ShikiSourceView] highlight error:", err);
        setHtml("");
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [content, language, canHighlight]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (!canHighlight) {
    return <PlainTextLargePreview content={content} language={language} />;
  }

  return (
    <div className="fv-source">
      {showToolbar && (
        <div className="fv-source__toolbar">
          <div className="fv-source__toolbar-left">
            <span className="fv-source__lang-badge">{language}</span>
            <span className="fv-source__line-count">
              {lineCount} line{lineCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="fv-source__toolbar-right">
            <button
              onClick={() => setWordWrap((w) => !w)}
              className={`fv-btn fv-btn--icon ${wordWrap ? "fv-source__btn-active" : ""}`}
              title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
            >
              <WrapTextIcon size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="fv-btn fv-btn--icon"
              title={t.copyCode}
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="fv-source__content">
        {loading ? (
          <div className="fv-source__loading">
            <div className="fv-source__loading-inner">
              <div className="fv-spinner" />
              <p className="fv-source__loading-label">Loading syntax highlighter...</p>
            </div>
          </div>
        ) : html ? (
          <div
            className={`fv-shiki-wrapper ${wordWrap ? "fv-shiki-wrap" : "fv-shiki-nowrap"}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="fv-shiki-plaintext">
            <pre>
              <code>
                {content.split("\n").map((line, i) => (
                  <div key={i} className="line">
                    <span className="linenumber">{i + 1}</span>
                    <span className="linecontent">{line || " "}</span>
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
