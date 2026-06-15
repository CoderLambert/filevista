import { useState, useEffect, useMemo } from "react";
import { CopyIcon, CheckIcon, WrapTextIcon } from "./icons";
import { highlightCode as shikiHighlight, getShikiLanguage } from "./shiki";
import { shouldHighlight } from "./limits";
import { PlainTextLargePreview } from "./PlainTextLargePreview";
import { useLocale } from "./core/i18n";
import "./styles/ShikiSourceView.css";

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
  const t = useLocale();

  const language = useMemo(
    () => (isJson ? "json" : getShikiLanguage(fileName)),
    [isJson, fileName]
  );

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

  const lineCount = useMemo(
    () => displayContent.split("\n").length,
    [displayContent]
  );

  const canHighlight = shouldHighlight(displayContent);

  const [prevDeps, setPrevDeps] = useState({ displayContent, language });
  if (prevDeps.displayContent !== displayContent || prevDeps.language !== language) {
    setPrevDeps({ displayContent, language });
    setHtml("");
    setError(null);
    setLoading(canHighlight);
  }

  useEffect(() => {
    if (!canHighlight) return;

    let cancelled = false;
    shikiHighlight(displayContent, language).then(
      (result) => {
        if (cancelled) return;
        setHtml(result);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("[CodePreview] Shiki highlight error:", err);
        setError(err instanceof Error ? err.message : "Highlight failed");
        setHtml("");
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [displayContent, language, canHighlight]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!canHighlight) {
    return <PlainTextLargePreview content={displayContent} language={language} />;
  }

  return (
    <div className="fv-source">
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
                {displayContent.split("\n").map((line, i) => (
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
