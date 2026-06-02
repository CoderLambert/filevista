# P1 - 大文件降级预览

## 背景

Code / JSON / Markdown / Text 文件如果很大，直接使用 Shiki 高亮可能导致浏览器卡顿。

## 涉及文件

```txt
src/components/file-preview/CodePreview.tsx
src/components/file-preview/MarkdownPreview.tsx
src/components/file-preview/ShikiSourceView.tsx
src/components/file-preview/TextPreview.tsx
src/components/file-preview/PlainTextLargePreview.tsx
src/components/file-preview/limits.ts
```

## 任务 1：新增 limits.ts

```ts
export const FILE_PREVIEW_LIMITS = {
  maxTextPreviewSize: 2 * 1024 * 1024,
  maxCodeHighlightSize: 500 * 1024,
  maxCodeHighlightLines: 5000,
  maxMarkdownHighlightBlocks: 50,
};
```

## 任务 2：新增 PlainTextLargePreview

```tsx
"use client";

import { useMemo, useState } from "react";
import { Copy, Check, WrapText, AlertTriangle } from "lucide-react";

interface PlainTextLargePreviewProps {
  content: string;
  fileName: string;
  reason?: string;
}

export function PlainTextLargePreview({
  content,
  fileName,
  reason,
}: PlainTextLargePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const lines = useMemo(() => content.split("\n"), [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs text-muted-foreground">
            {reason || "文件较大，已使用纯文本模式"}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">
            {lines.length} lines
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWordWrap((v) => !v)}
            className="p-1.5 rounded-md hover:bg-muted"
          >
            <WrapText size={14} />
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-muted"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <pre
          className={`p-4 text-xs leading-6 font-mono ${
            wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
          }`}
        >
          {content}
        </pre>
      </div>
    </div>
  );
}
```

## 任务 3：CodePreview 增加降级

```ts
const shouldUseHighlight =
  displayContent.length <= FILE_PREVIEW_LIMITS.maxCodeHighlightSize &&
  lineCount <= FILE_PREVIEW_LIMITS.maxCodeHighlightLines;
```

如果不满足：

```tsx
return (
  <PlainTextLargePreview
    content={displayContent}
    fileName={fileName}
    reason="代码文件较大，已关闭语法高亮以避免浏览器卡顿"
  />
);
```

## 任务 4：Markdown 代码块高亮缓存

新增缓存：

```ts
const markdownHighlightCache = new Map<string, string>();

async function highlightMarkdownCode(code: string, language: string) {
  const key = `${language}:${code}`;

  const cached = markdownHighlightCache.get(key);
  if (cached) return cached;

  const html = await highlightCode(code, language);
  markdownHighlightCache.set(key, html);

  return html;
}
```

## 任务 5：Markdown 大文件降级

如果 Markdown 文件超过阈值：

```tsx
return (
  <PlainTextLargePreview
    content={content}
    fileName="markdown.md"
    reason="Markdown 文件较大，已切换为源码模式"
  />
);
```

## 验收标准

| 文件         | 预期             |
| ---------- | -------------- |
| 100KB TS   | 正常 Shiki 高亮    |
| 1MB TS     | 降级纯文本          |
| 5MB JSON   | 降级纯文本          |
| 10MB log   | 降级纯文本          |
| 大 Markdown | 源码模式或有限高亮，不应卡死 |
