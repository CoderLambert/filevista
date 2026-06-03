"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, Download, FileQuestion, Loader2 } from "lucide-react";
import type { FileType } from "../utils";
import { base64ToUint8Array } from "../utils";

interface UnsupportedPluginPreviewProps {
  fileType: FileType;
  fileName?: string;
  content?: string | null;
  title?: string;
  description?: string;
}

/**
 * Map of user-friendly Chinese titles for unsupported/degraded file types.
 */
const UNSUPPORTED_TITLES: Record<string, string> = {
  doc: "旧版 Word 格式暂不支持",
  ppt: "旧版 PowerPoint 格式暂不支持",
  xls: "旧版 Excel 格式暂不支持",
};

/**
 * Map of user-friendly Chinese descriptions for unsupported/degraded file types.
 */
const UNSUPPORTED_DESCRIPTIONS: Record<string, string> = {
  doc: "该文件为旧版 .doc 二进制格式，当前浏览器端预览仅支持 .docx。建议使用 Word 或 WPS 将文件另存为 .docx 后重试。",
  ppt: "该文件为旧版 .ppt 二进制格式，当前浏览器端预览仅支持 .pptx。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 后重试。",
  xls: "该文件为旧版 .xls 二进制格式，当前浏览器端预览仅支持 .xlsx。建议使用 Excel 或 WPS 将文件另存为 .xlsx 后重试。",
};

/**
 * MIME types for legacy office formats.
 */
const LEGACY_OFFICE_MIME_TYPES: Record<string, string> = {
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",
};

export function UnsupportedPluginPreview({
  fileType,
  fileName,
  content,
  title,
  description,
}: UnsupportedPluginPreviewProps) {
  const [downloading, setDownloading] = useState(false);

  const displayTitle =
    title ?? UNSUPPORTED_TITLES[fileType] ?? "Preview Not Available";
  const displayDescription =
    description ??
    UNSUPPORTED_DESCRIPTIONS[fileType] ??
    `该文件类型 (${fileType}) 暂不支持浏览器端预览。`;

  const handleDownload = () => {
    if (!content || !fileName || downloading) return;

    setDownloading(true);

    const bytes = base64ToUint8Array(content);
    const mimeType = LEGACY_OFFICE_MIME_TYPES[fileType] || "application/octet-stream";
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-75 text-muted-foreground gap-4 px-6">
      {fileType === "unknown" ? (
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      ) : (
        <AlertTriangle className="h-10 w-10 text-amber-500" />
      )}

      <div className="space-y-2 text-center">
        <p className="text-lg font-medium text-foreground">{displayTitle}</p>
        <p className="text-sm max-w-md">{displayDescription}</p>
      </div>

      {content && fileName && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-all ${
            downloading
              ? "bg-green-600 text-white cursor-wait"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {downloading ? (
            <>
              <CheckCircle size={14} />
              已开始下载
            </>
          ) : (
            <>
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              下载原文件
            </>
          )}
        </button>
      )}
    </div>
  );
}
