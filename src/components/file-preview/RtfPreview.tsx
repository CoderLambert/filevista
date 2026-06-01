"use client";

interface RtfPreviewProps {
  content: string;
  fileName: string;
}

/**
 * Basic RTF text extractor.
 * RTF format uses {\rtf1 ...} with control words like \b, \i, \par, etc.
 * This extracts plain text by stripping control words and braces.
 */
function extractRtfText(rtf: string): string[] {
  const paragraphs: string[] = [];

  // Remove header groups like {\rtf1\ansi\deff0...}
  let text = rtf;

  // Remove binary data ({\*\...} groups)
  text = text.replace(/\{\\[\*]([^{}]*)\}/g, "");

  // Remove font table, color table, etc.
  text = text.replace(/\{\\fonttbl[^}]*\}/gi, "");
  text = text.replace(/\{\\colortbl[^}]*\}/gi, "");
  text = text.replace(/\{\\stylesheet[^}]*\}/gi, "");
  text = text.replace(/\{\\info[^}]*\}/gi, "");
  text = text.replace(/\{\\generator[^}]*\}/gi, "");

  // Replace \par and \line with newlines
  text = text.replace(/\\par\b/g, "\n");
  text = text.replace(/\\line\b/g, "\n");
  text = text.replace(/\\tab\b/g, "\t");

  // Remove remaining control words (\word followed by optional number and space)
  text = text.replace(/\\[a-z]+(-?\d+)? ?/gi, "");

  // Remove special characters
  text = text.replace(/\\['"][0-9a-f]{2}/gi, ""); // hex chars
  text = text.replace(/\\[{}\\]/g, (match) => {
    switch (match) {
      case "\\\\": return "\\";
      case "\\{": return "{";
      case "\\}": return "}";
      default: return "";
    }
  });

  // Remove remaining braces
  text = text.replace(/[{}]/g, "");

  // Clean up whitespace
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");

  // Split into paragraphs
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      paragraphs.push(trimmed);
    }
  }

  return paragraphs;
}

export function RtfPreview({ content, fileName }: RtfPreviewProps) {
  const paragraphs = extractRtfText(content);

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b">
          <span className="text-sm">📃</span>
          <span className="text-xs text-muted-foreground">{fileName}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">RTF Format</span>
        </div>
        <div className="space-y-3">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${
                i === 0 && para.length < 100 ? "text-lg font-semibold text-gray-900 dark:text-gray-100" : ""
              }`}
            >
              {para}
            </p>
          ))}
          {paragraphs.length === 0 && (
            <p className="text-muted-foreground text-sm">No text content could be extracted.</p>
          )}
        </div>
      </div>
    </div>
  );
}
