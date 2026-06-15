import { AlertTriangleIcon } from "./icons";
import type { FileInfo, FileType } from "./utils";
import { useLocale } from "./core/i18n";
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
  const t = useLocale();

  if (!HEAVY_FILE_TYPES.has(file.fileType)) return null;
  if (file.size < LARGE_FILE_THRESHOLD) return null;

  return (
    <div className="fv-file-hint">
      <AlertTriangleIcon size={14} />
      <span>
        {t.largeFileHint}
      </span>
    </div>
  );
}
