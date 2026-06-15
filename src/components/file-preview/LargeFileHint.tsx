import { AlertTriangleIcon } from "./icons";
import type { FileInfo, FileType } from "./utils";
import "./styles/LargeFileHint.css";

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
    <div className="fv-file-hint">
      <AlertTriangleIcon size={14} />
      <span>
        当前文件较大，浏览器端解析可能需要更长时间，期间页面可能短暂卡顿。
      </span>
    </div>
  );
}
