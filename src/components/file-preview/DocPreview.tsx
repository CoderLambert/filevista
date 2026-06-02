"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download } from "lucide-react";
import { base64ToUint8Array } from "./utils";

interface DocPreviewProps {
  content: string;
  fileName: string;
}

interface DocTextExtraction {
  paragraphs: string[];
  warning?: string;
}

/**
 * Extract readable text from legacy .doc (Binary Interchange File Format) files.
 * .doc files contain text in various encodings within the binary structure.
 * This is a best-effort extraction - complex formatting and embedded objects won't be preserved.
 */
function extractTextFromDoc(arrayBuffer: ArrayBuffer): DocTextExtraction {
  const bytes = new Uint8Array(arrayBuffer);
  const paragraphs: string[] = [];
  let warning: string | undefined;

  // Try to find the WordDocument stream in the OLE2 compound file
  // The .doc format stores text in the "WordDocument" stream
  // We'll use a heuristic approach to extract readable text

  // Method 1: Try to extract Unicode text (UTF-16LE) from the file
  // In .doc files, text is often stored as UTF-16LE in specific sections
  const textChunks: string[] = [];
  let currentParagraph = "";

  // Scan for readable text sequences
  // .doc files have a complex structure, but text content is often
  // stored in contiguous readable regions
  const decoder = new TextDecoder("utf-16le");
  const latinDecoder = new TextDecoder("windows-1252");

  // Try UTF-16LE extraction first
  // Look for regions with ASCII-compatible UTF-16LE characters
  let inText = false;
  let textStart = 0;

  for (let i = 0; i < bytes.length - 1; i++) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1];

    // Check if this looks like a printable UTF-16LE character
    // (byte1 is printable ASCII, byte2 is 0)
    const isPrintableUtf16 =
      byte2 === 0 &&
      ((byte1 >= 0x20 && byte1 <= 0x7e) || // ASCII printable
        byte1 === 0x0d || // CR
        byte1 === 0x0a || // LF
        byte1 === 0x09);  // Tab

    if (isPrintableUtf16 && !inText) {
      inText = true;
      textStart = i;
    } else if (!isPrintableUtf16 && inText) {
      // End of text run
      if (i - textStart >= 4) {
        // At least 2 characters
        const chunk = decoder.decode(bytes.slice(textStart, i));
        const cleaned = chunk
          .replace(/\0/g, "")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .trim();

        if (cleaned.length >= 2) {
          // Split into paragraphs
          const parts = cleaned.split("\n");
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
              // Check if it looks like real text (has letters/digits)
              if (/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af0-9]/.test(trimmed)) {
                textChunks.push(trimmed);
              }
            }
          }
        }
      }
      inText = false;
    }
  }

  // If UTF-16LE didn't yield much, try Windows-1252 (Latin-1)
  if (textChunks.length < 3) {
    textChunks.length = 0;
    inText = false;

    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      const isPrintable =
        (b >= 0x20 && b <= 0x7e) || // ASCII
        b >= 0x80 || // Extended Latin
        b === 0x0d ||
        b === 0x0a ||
        b === 0x09;

      if (isPrintable && !inText) {
        inText = true;
        textStart = i;
      } else if (!isPrintable && inText) {
        if (i - textStart >= 4) {
          const chunk = latinDecoder.decode(bytes.slice(textStart, i));
          const cleaned = chunk
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();

          if (cleaned.length >= 2) {
            const parts = cleaned.split("\n");
            for (const part of parts) {
              const trimmed = part.trim();
              if (trimmed && /[a-zA-Z\u4e00-\u9fff0-9]/.test(trimmed)) {
                textChunks.push(trimmed);
              }
            }
          }
        }
        inText = false;
      }
    }
  }

  // Deduplicate and clean up paragraphs
  const seen = new Set<string>();
  for (const chunk of textChunks) {
    // Skip very short chunks that are likely noise
    if (chunk.length < 2) continue;
    // Skip chunks that look like binary garbage
    if (/[^\x20-\x7E\xA0-\xFF\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\s]/.test(chunk)) {
      const printableRatio = (chunk.match(/[\x20-\x7E]/g) || []).length / chunk.length;
      if (printableRatio < 0.6) continue;
    }
    const key = chunk.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      paragraphs.push(chunk);
    }
  }

  if (paragraphs.length === 0) {
    warning = "No readable text could be extracted from this .doc file. The file may use a format that is not supported for text extraction.";
  } else {
    warning = "This is a legacy .doc file. Text has been extracted but formatting, images, and layout are not preserved. For best results, convert to .docx format.";
  }

  return { paragraphs, warning };
}

export function DocPreview({ content, fileName }: DocPreviewProps) {
  const [extraction, setExtraction] = useState<DocTextExtraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const extract = async () => {
      try {
        setLoading(true);
        const bytes = base64ToUint8Array(content);
        const result = extractTextFromDoc(bytes.buffer);
        setExtraction(result);
      } catch (err) {
        console.error("Error extracting .doc text:", err);
        setError(
          err instanceof Error ? err.message : "Failed to extract text"
        );
      } finally {
        setLoading(false);
      }
    };

    extract();
  }, [content]);

  const handleDownload = () => {
    const bytes = base64ToUint8Array(content);
    const blob = new Blob([bytes], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">
          Extracting text from document...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <AlertCircle size={48} />
        <p className="text-lg font-medium">Extraction Failed</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={handleDownload}
          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="inline h-4 w-4 mr-1.5" />
          Download File
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Warning banner */}
      {extraction?.warning && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <AlertCircle
            size={18}
            className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {extraction.warning}
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="shrink-0 px-3 py-1 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center gap-1"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      )}

      {/* Extracted text content */}
      <div className="flex-1 overflow-auto p-6">
        {extraction && extraction.paragraphs.length > 0 ? (
          <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 sm:p-8 space-y-3">
            {extraction.paragraphs.map((para, i) => (
              <p
                key={i}
                className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${
                  i === 0 && para.length < 100
                    ? "text-lg font-semibold text-gray-900 dark:text-gray-100"
                    : ""
                }`}
              >
                {para}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" />
            </svg>
            <p className="text-lg font-medium">No Text Extracted</p>
            <p className="text-sm">
              Could not extract readable text from this .doc file.
            </p>
            <button
              onClick={handleDownload}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
