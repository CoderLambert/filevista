import { useEffect, useState } from "react";
import JSZip from "jszip";
import { FileIcon, FolderIcon, FolderOpenIcon } from "./icons";
import { formatFileSize, base64ToUint8Array } from "./utils";
import "./styles/ZipPreview.css";

interface ZipPreviewProps {
  content: string;
  fileName: string;
}

interface ZipEntry {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  depth: number;
  ext: string;
}

async function parseZipFile(base64Content: string): Promise<ZipEntry[]> {
  const bytes = base64ToUint8Array(base64Content);

  const zip = await JSZip.loadAsync(bytes);
  const entries: ZipEntry[] = [];

  zip.forEach((relativePath, file) => {
    const parts = relativePath.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || relativePath;
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    const depth = parts.length - 1;

    const internal = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
    const size = internal?.uncompressedSize ?? 0;

    entries.push({
      path: relativePath,
      name,
      size,
      isDir: file.dir,
      depth,
      ext,
    });
  });

  entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.path.localeCompare(b.path);
  });

  return entries;
}

function getFileIcon(entry: ZipEntry): string {
  if (entry.isDir) return "📁";
  const iconMap: Record<string, string> = {
    pdf: "📄", doc: "📃", docx: "📃", ppt: "📊", pptx: "📊",
    xls: "📊", xlsx: "📊", jpg: "🖼️", jpeg: "🖼️", png: "🖼️",
    gif: "🖼️", svg: "🖼️", webp: "🖼️", mp4: "🎬", mp3: "🎵",
    zip: "📦", rar: "📦", "7z": "📦", tar: "📦", gz: "📦",
    js: "💻", ts: "💻", py: "💻", html: "🌐", css: "🎨",
    json: "🔧", xml: "🔧", md: "📝", txt: "📄", csv: "📊",
  };
  return iconMap[entry.ext] || "📎";
}

export function ZipPreview({ content, fileName }: ZipPreviewProps) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevContent, setPrevContent] = useState(content);
  if (prevContent !== content) {
    setPrevContent(content);
    setLoading(true);
    setError(null);
    setEntries([]);
  }

  useEffect(() => {
    let cancelled = false;
    parseZipFile(content).then(
      (result) => {
        if (cancelled) return;
        setEntries(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Error parsing ZIP:", err);
        setError(err instanceof Error ? err.message : "Failed to parse archive");
        setLoading(false);
      }
    );
    return () => { cancelled = true; };
  }, [content]);

  const fileCount = entries.filter(e => !e.isDir).length;
  const dirCount = entries.filter(e => e.isDir).length;
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

  if (loading) {
    return (
      <div className="fv-zip__loading">
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-zip__loading-label">Reading archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fv-zip__error">
        <p className="fv-zip__error-title">Parsing Failed</p>
        <p className="fv-zip__error-msg">{error}</p>
      </div>
    );
  }

  return (
    <div className="fv-zip">
      <div className="fv-zip__summary">
        <span className="fv-zip__summary-item">
          <FolderOpenIcon size={14} />
          {dirCount} folder{dirCount !== 1 ? "s" : ""}
        </span>
        <span className="fv-zip__summary-item">
          <FileIcon size={14} />
          {fileCount} file{fileCount !== 1 ? "s" : ""}
        </span>
        <span>•</span>
        <span>Total: {formatFileSize(totalSize)}</span>
      </div>

      <div className="fv-zip__tree">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="fv-zip__entry"
            style={{ paddingLeft: `${12 + entry.depth * 20}px` }}
          >
            <span className="fv-zip__entry-icon">{getFileIcon(entry)}</span>
            <span className={`fv-zip__entry-name ${entry.isDir ? "fv-zip__entry-name--dir" : ""}`}>
              {entry.name}
            </span>
            {!entry.isDir && entry.size > 0 && (
              <span className="fv-zip__entry-size">{formatFileSize(entry.size)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
