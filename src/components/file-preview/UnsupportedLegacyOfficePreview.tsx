"use client";

import { AlertTriangle, Download } from "lucide-react";
import { base64ToUint8Array } from "./utils";

interface UnsupportedLegacyOfficePreviewProps {
  type: "ppt" | "xls";
  fileName: string;
  content?: string | null;
  title: string;
  description: string;
}

export function UnsupportedLegacyOfficePreview({
  type,
  fileName,
  content,
  title,
  description,
}: UnsupportedLegacyOfficePreviewProps) {
  const handleDownload = () => {
    if (!content) return;

    const bytes = base64ToUint8Array(content);
    const blob = new Blob([bytes as unknown as BlobPart], {
      type:
        type === "ppt"
          ? "application/vnd.ms-powerpoint"
          : "application/vnd.ms-excel",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-75 text-muted-foreground gap-4 px-6">
      <AlertTriangle className="h-10 w-10 text-amber-500" />

      <div className="space-y-2 text-center">
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="text-sm max-w-md">{description}</p>
      </div>

      {content && (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Download size={14} />
          下载原文件
        </button>
      )}
    </div>
  );
}
