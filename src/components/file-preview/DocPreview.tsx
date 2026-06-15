import { useEffect, useState } from "react";
import { AlertCircleIcon, DownloadIcon } from "./icons";
import { base64ToUint8Array } from "./utils";
import "./styles/DocPreview.css";

interface DocPreviewProps {
  content: string;
  fileName: string;
}

interface DocTextExtraction {
  paragraphs: string[];
  warning?: string;
}

function extractTextFromDoc(bytes: Uint8Array): DocTextExtraction {
  const paragraphs: string[] = [];
  let warning: string | undefined;

  const textChunks: string[] = [];
  let currentParagraph = "";

  const decoder = new TextDecoder("utf-16le");
  const latinDecoder = new TextDecoder("windows-1252");

  let inText = false;
  let textStart = 0;

  for (let i = 0; i < bytes.length - 1; i++) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1];

    const isPrintableUtf16 =
      byte2 === 0 &&
      ((byte1 >= 0x20 && byte1 <= 0x7e) ||
        byte1 === 0x0d ||
        byte1 === 0x0a ||
        byte1 === 0x09);

    if (isPrintableUtf16 && !inText) {
      inText = true;
      textStart = i;
    } else if (!isPrintableUtf16 && inText) {
      if (i - textStart >= 4) {
        const chunk = decoder.decode(bytes.slice(textStart, i));
        const cleaned = chunk
          .replace(/\0/g, "")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .trim();

        if (cleaned.length >= 2) {
          const parts = cleaned.split("\n");
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
              if (/[a-zA-Z一-鿿぀-ゟ゠-ヿ가-힯0-9]/.test(trimmed)) {
                textChunks.push(trimmed);
              }
            }
          }
        }
      }
      inText = false;
    }
  }

  if (textChunks.length < 3) {
    textChunks.length = 0;
    inText = false;

    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      const isPrintable =
        (b >= 0x20 && b <= 0x7e) ||
        b >= 0x80 ||
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
              if (trimmed && /[a-zA-Z一-鿿0-9]/.test(trimmed)) {
                textChunks.push(trimmed);
              }
            }
          }
        }
        inText = false;
      }
    }
  }

  const seen = new Set<string>();
  for (const chunk of textChunks) {
    if (chunk.length < 2) continue;
    if (/[^\x20-\x7E\xA0-\xFF一-鿿぀-ゟ゠-ヿ가-힯\s]/.test(chunk)) {
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
        const result = extractTextFromDoc(bytes);
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
    const blob = new Blob([bytes], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="fv-doc__loading">
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-doc__loading-label">Extracting text from document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fv-doc__error">
        <AlertCircleIcon size={48} />
        <p className="fv-doc__error-title">Extraction Failed</p>
        <p className="fv-doc__error-msg">{error}</p>
        <button onClick={handleDownload} className="fv-btn fv-btn--primary" style={{ marginTop: '0.5rem' }}>
          <DownloadIcon size={16} /> Download File
        </button>
      </div>
    );
  }

  return (
    <div className="fv-doc">
      {extraction?.warning && (
        <div className="fv-doc__warning">
          <AlertCircleIcon size={18} className="fv-doc__warning-icon" />
          <div className="fv-doc__warning-text">
            {extraction.warning}
          </div>
          <button onClick={handleDownload} className="fv-doc__download-sm">
            <DownloadIcon size={12} /> Download
          </button>
        </div>
      )}

      <div className="fv-doc__content">
        {extraction && extraction.paragraphs.length > 0 ? (
          <div className="fv-doc__paper">
            {extraction.paragraphs.map((para, i) => (
              <p
                key={i}
                className={`fv-doc__paragraph ${i === 0 && para.length < 100 ? "fv-doc__paragraph--title" : ""}`}
              >
                {para}
              </p>
            ))}
          </div>
        ) : (
          <div className="fv-doc__empty">
            <AlertCircleIcon size={48} />
            <p className="fv-doc__empty-title">No Text Extracted</p>
            <p className="fv-doc__empty-desc">Could not extract readable text from this .doc file.</p>
            <button onClick={handleDownload} className="fv-btn fv-btn--primary" style={{ marginTop: '0.5rem' }}>
              <DownloadIcon size={14} /> Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
