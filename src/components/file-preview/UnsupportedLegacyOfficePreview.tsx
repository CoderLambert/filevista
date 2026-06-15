import { AlertTriangleIcon, DownloadIcon } from "./icons";
import { base64ToUint8Array } from "./utils";
import "./styles/UnsupportedLegacyOfficePreview.css";

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
    <div className="fv-legacy-office">
      <AlertTriangleIcon size={40} className="fv-legacy-office__icon" />

      <div className="fv-legacy-office__body">
        <p className="fv-legacy-office__title">{title}</p>
        <p className="fv-legacy-office__desc">{description}</p>
      </div>

      {content && (
        <button
          onClick={handleDownload}
          className="fv-btn fv-btn--primary"
        >
          <DownloadIcon size={14} />
          下载原文件
        </button>
      )}
    </div>
  );
}
