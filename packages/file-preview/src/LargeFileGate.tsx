import { AlertTriangleIcon, DownloadIcon } from "./icons";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { getPreviewSizePolicy } from "./performance-limits";
import { downloadSource } from "./core/download";
import "./styles/LargeFileGate.css";

interface LargeFileGateProps {
  file: FileInfo;
  confirmed: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function LargeFileGate({
  file,
  confirmed,
  onConfirm,
  children,
}: LargeFileGateProps) {
  const policy = getPreviewSizePolicy({
    size: file.size,
    fileType: file.fileType,
  });

  if (!policy.shouldWarn) {
    return <>{children}</>;
  }

  if (policy.level === "warning") {
    return (
      <div className="fv-gate-warning">
        <div className="fv-gate-warning__inner">
          <AlertTriangleIcon size={14} />
          <span>
            Large file: {formatFileSize(file.size)}. Preview may be slower.
          </span>
        </div>
      </div>
    );
  }

  if (policy.shouldConfirm && !confirmed) {
    return (
      <div className="fv-gate-confirm">
        <AlertTriangleIcon size={48} className="fv-gate-confirm__icon" />
        <div className="fv-gate-confirm__body">
          <h3 className="fv-gate-confirm__title">Large file preview</h3>
          <p className="fv-gate-confirm__desc">
            {policy.message}
          </p>
          <p className="fv-gate-confirm__meta">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <div className="fv-gate-confirm__actions">
          <button className="fv-btn fv-btn--primary" onClick={onConfirm}>Preview anyway</button>
          <button
            className="fv-btn fv-btn--outline"
            onClick={() => downloadSource(file.source, file.name, file.type)}
          >
            <DownloadIcon size={16} /> Download
          </button>
        </div>
      </div>
    );
  }

  if (policy.shouldBlock) {
    return (
      <div className="fv-gate-confirm">
        <AlertTriangleIcon size={48} className="fv-gate-confirm__icon fv-gate-confirm__icon--block" />
        <div className="fv-gate-confirm__body">
          <h3 className="fv-gate-confirm__title">File too large to preview</h3>
          <p className="fv-gate-confirm__desc">
            {policy.message}
          </p>
          <p className="fv-gate-confirm__meta">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <button
          className="fv-btn fv-btn--outline"
          onClick={() => downloadSource(file.source, file.name, file.type)}
        >
          <DownloadIcon size={16} /> Download original file
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
