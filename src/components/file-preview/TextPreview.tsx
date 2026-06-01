"use client";

import { Copy, Check, WrapText } from "lucide-react";
import { useState } from "react";

interface TextPreviewProps {
  content: string;
  fileName: string;
}

export function TextPreview({ content, fileName }: TextPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split("\n");

  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setWrap(!wrap)}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
          title={wrap ? "Disable word wrap" : "Enable word wrap"}
        >
          <WrapText size={14} />
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-gray-200 transition-colors"
          title="Copy text"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="bg-[#282c34] rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-[#21252b] border-b border-[#181a1f] text-xs text-gray-400 font-mono">
          {fileName}
        </div>
        <div
          className="p-4 font-mono text-sm leading-relaxed overflow-auto max-h-[70vh]"
          style={{ whiteSpace: wrap ? "pre-wrap" : "pre" }}
        >
          {lines.map((line, i) => (
            <div key={i} className="flex hover:bg-white/5 -mx-4 px-4">
              <span className="inline-block w-12 text-right pr-4 text-gray-500 select-none shrink-0 text-xs leading-relaxed">
                {i + 1}
              </span>
              <span className="text-[#abb2bf] flex-1">{line || "\u00A0"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
