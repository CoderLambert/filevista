"use client";

import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { getLanguageFromFilename } from "./utils";

interface CodePreviewProps {
  content: string;
  fileName: string;
  isJson?: boolean;
}

export function CodePreview({ content, fileName, isJson }: CodePreviewProps) {
  const [copied, setCopied] = useState(false);
  const language = isJson ? "json" : getLanguageFromFilename(fileName);

  let displayContent = content;
  if (isJson) {
    try {
      displayContent = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // keep original content if parsing fails
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400 font-mono">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0.5rem",
          fontSize: "0.8125rem",
          lineHeight: "1.6",
          padding: "1.5rem",
          paddingTop: "2.5rem",
        }}
        showLineNumbers
        lineNumberStyle={{
          minWidth: "3em",
          paddingRight: "1em",
          color: "#636d83",
          userSelect: "none",
        }}
        wrapLongLines
      >
        {displayContent}
      </SyntaxHighlighter>
    </div>
  );
}
