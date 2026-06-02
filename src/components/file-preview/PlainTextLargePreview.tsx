"use client";

import { useState, useCallback, useMemo } from "react";
import { Copy, Check, WrapText } from "lucide-react";
import { formatFileSize, truncateContent } from "./limits";

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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
            {language}
          </span>
          <span className="text-xs text-muted-foreground">
            {lineCount.toLocaleString()} 行
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(fileSize)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            大文件
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
            title={wordWrap ? "关闭自动换行" : "开启自动换行"}
          >
            <WrapText size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            title="复制内容"
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Plain text content with line numbers */}
      <style dangerouslySetInnerHTML={{ __html: PLAIN_TEXT_STYLES }} />
      <div className={`flex-1 overflow-auto plain-text-wrapper ${wordWrap ? "plain-text-wrap" : "plain-text-nowrap"}`}>
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
    </div>
  );
}

const PLAIN_TEXT_STYLES = `
  .plain-text-wrapper pre {
    margin: 0;
    padding: 1rem 1.5rem;
    font-size: 0.8125rem;
    line-height: 1.7;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace;
    background-color: #f6f8fa;
    tab-size: 2;
  }
  .dark .plain-text-wrapper pre {
    background-color: #1b1f23;
    color: #e1e4e8;
  }
  .plain-text-wrap pre { white-space: pre-wrap; word-break: break-word; }
  .plain-text-nowrap pre { white-space: pre; overflow-x: auto; }
  .plain-text-wrapper .line {
    display: flex;
    min-height: 1.7em;
  }
  .plain-text-wrapper .linenumber {
    display: inline-block;
    width: 2.5em;
    text-align: right;
    padding-right: 1em;
    opacity: 0.3;
    user-select: none;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .plain-text-wrapper .linecontent {
    flex: 1;
  }
  .plain-text-wrap .linecontent {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .plain-text-nowrap .linecontent {
    white-space: pre;
  }
`;
