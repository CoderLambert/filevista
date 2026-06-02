"use client";

import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import { File, Folder, FolderOpen } from "lucide-react";
import { formatFileSize, base64ToUint8Array } from "./utils";

interface ZipPreviewProps {
  content: string; // base64 encoded
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

  const zip = await JSZip.loadAsync(bytes.buffer as ArrayBuffer);
  const entries: ZipEntry[] = [];

  zip.forEach((relativePath, file) => {
    const parts = relativePath.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || relativePath;
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    const depth = parts.length - 1;

    entries.push({
      path: relativePath,
      name,
      size: (file as any)._data?.uncompressedSize ?? 0,
      isDir: file.dir,
      depth,
      ext,
    });
  });

  // Sort: directories first, then by path
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

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parseZipFile(content);
      setEntries(result);
    } catch (err) {
      console.error("Error parsing ZIP:", err);
      setError(err instanceof Error ? err.message : "Failed to parse archive");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => { parseFile(); }, [parseFile]);

  const fileCount = entries.filter(e => !e.isDir).length;
  const dirCount = entries.filter(e => e.isDir).length;
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Reading archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <p className="text-lg font-medium">Parsing Failed</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FolderOpen size={14} />
          {dirCount} folder{dirCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <File size={14} />
          {fileCount} file{fileCount !== 1 ? "s" : ""}
        </span>
        <span>•</span>
        <span>Total: {formatFileSize(totalSize)}</span>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-0.5">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
              style={{ paddingLeft: `${12 + entry.depth * 20}px` }}
            >
              <span className="text-sm shrink-0">{getFileIcon(entry)}</span>
              <span className={`text-sm truncate flex-1 ${entry.isDir ? "font-medium" : ""}`}>
                {entry.name}
              </span>
              {!entry.isDir && entry.size > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatFileSize(entry.size)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
