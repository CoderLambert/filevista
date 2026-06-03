import { AlertTriangle } from "lucide-react";
import type { FileInfo, FileType } from "./utils";

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20 MB

const HEAVY_FILE_TYPES = new Set<FileType>([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "zip",
  "epub",
]);

export function LargeFileHint({ file }: { file: FileInfo }) {
  if (!HEAVY_FILE_TYPES.has(file.fileType)) return null;
  if (file.size < LARGE_FILE_THRESHOLD) return null;

  return (
    <div className="flex items-center gap-2 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        当前文件较大，浏览器端解析可能需要更长时间，期间页面可能短暂卡顿。
      </span>
    </div>
  );
}
