import { useState, useCallback, useMemo } from "react";
import { CopyIcon, CheckIcon, WrapTextIcon } from "./icons";
import { formatFileSize } from "./utils";
import { truncateContent } from "./limits";
import "./styles/PlainTextLargePreview.css";

interface PlainTextLargePreviewProps {
  content: string;
  language: string;
}

export function PlainTextLargePreview({ content, language }: PlainTextLargePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const displayContent = useMemo(() => truncateContent(content), [content]);
  const lineCount = useMemo(() => content.split("\n").length, [content]);
  const fileSize = useMemo(() => content.length, [content]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="fv-plain-text">
      <div className="fv-plain-text__toolbar">
        <div className="fv-plain-text__toolbar-left">
          <span className="fv-plain-text__lang-badge">{language}</span>
          <span className="fv-plain-text__line-count">
            {lineCount.toLocaleString()} 行
          </span>
          <span className="fv-plain-text__file-size">
            {formatFileSize(fileSize)}
          </span>
          <span className="fv-plain-text__large-badge">大文件</span>
        </div>
        <div className="fv-plain-text__toolbar-right">
          <button
            onClick={() => setWordWrap((w) => !w)}
            className={`fv-btn fv-btn--icon ${wordWrap ? "fv-source__btn-active" : ""}`}
            title={wordWrap ? "关闭自动换行" : "开启自动换行"}
          >
            <WrapTextIcon size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="fv-btn fv-btn--icon"
            title="复制内容"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </button>
        </div>
      </div>

      <div className={`fv-plain-text__content ${wordWrap ? "fv-plain-text__content--wrap" : "fv-plain-text__content--nowrap"}`}>
        <pre>
          <code>
            {displayContent.split("\n").map((line, i) => (
              <div key={i} className="line">
                <span className="linenumber">{i + 1}</span>
                <span className="linecontent">{line || " "}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
