"use client";

import type { FileInfo } from "../utils";
import { PreviewFallback } from "../PreviewFallback";

export interface UnsupportedPluginPreviewProps {
  file: FileInfo;
  title?: string;
  description?: string;
}

/**
 * Map of user-friendly Chinese titles for unsupported file types.
 */
const UNSUPPORTED_TITLES: Record<string, string> = {
  doc: "旧版 Word 格式暂不支持",
  ppt: "旧版 PowerPoint 格式暂不支持",
  xls: "旧版 Excel 格式暂不支持",
};

/**
 * Map of user-friendly Chinese descriptions for unsupported file types.
 */
const UNSUPPORTED_DESCRIPTIONS: Record<string, string> = {
  doc: "该文件为旧版 .doc 二进制格式，当前浏览器端预览仅支持 .docx。建议使用 Word 或 WPS 将文件另存为 .docx 后重试。",
  ppt: "该文件为旧版 .ppt 二进制格式，当前浏览器端预览仅支持 .pptx。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 后重试。",
  xls: "该文件为旧版 .xls 二进制格式，当前浏览器端预览仅支持 .xlsx。建议使用 Excel 或 WPS 将文件另存为 .xlsx 后重试。",
};

export function UnsupportedPluginPreview({
  file,
  title,
  description,
}: UnsupportedPluginPreviewProps) {
  return (
    <PreviewFallback
      kind="unsupported"
      file={file}
      title={
        title ?? UNSUPPORTED_TITLES[file.fileType] ?? "Preview Not Available"
      }
      description={
        description ??
        UNSUPPORTED_DESCRIPTIONS[file.fileType] ??
        `该文件类型 (${file.fileType}) 暂不支持浏览器端预览。`
      }
      canDownload
    />
  );
}
