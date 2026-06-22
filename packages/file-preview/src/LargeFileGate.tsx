"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, DownloadIcon } from "./icons";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { getPreviewSizePolicy } from "./performance-limits";
import { downloadSource } from "./core/download";
import "./styles/LargeFileGate.css";

interface LargeFileGateProps {
  file: FileInfo;
  children: React.ReactNode;
  /**
   * Bypass the gate entirely and render children as-is.
   *
   * Useful when a consumer wants to manage large-file policy themselves
   * (or disable it for trusted, internal-only previews). The default
   * `PluginPreviewRenderer` already applies this gate, so most consumers
   * never instantiate `LargeFileGate` directly.
   */
  disabled?: boolean;
}

/**
 * Self-contained large-file gate.
 *
 * Wraps a preview and, based on `file.size`, shows:
 *   - 20 MB+ : a non-blocking "may be slower" banner above the preview
 *   - 50 MB+ : a confirm prompt (user must click "Preview anyway")
 *   - 100 MB+: blocks preview entirely, offers download only
 *
 * The confirm state is internal and resets when `file.id` changes, so the
 * gate is a drop-in wrapper — no external state plumbing required.
 *
 * Thresholds live in `PREVIEW_SIZE_LIMITS` (performance-limits.ts).
 */
export function LargeFileGate({
  file,
  children,
  disabled = false,
}: LargeFileGateProps) {
  const [confirmed, setConfirmed] = useState(false);

  // Reset the confirm decision whenever the user switches to a different
  // file — confirming one large file must not auto-confirm the next.
  useEffect(() => {
    setConfirmed(false);
  }, [file.id]);

  const policy = getPreviewSizePolicy({
    size: file.size,
    fileType: file.fileType,
  });

  if (disabled || !policy.shouldWarn) {
    return <>{children}</>;
  }

  // Block: never render the preview, only offer download.
  if (policy.shouldBlock) {
    return (
      <div className="fv-gate-confirm">
        <AlertTriangleIcon size={48} className="fv-gate-confirm__icon fv-gate-confirm__icon--block" />
        <div className="fv-gate-confirm__body">
          <h3 className="fv-gate-confirm__title">File too large to preview</h3>
          <p className="fv-gate-confirm__desc">{policy.message}</p>
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

  // Confirm: require an explicit "Preview anyway" before rendering.
  if (policy.shouldConfirm && !confirmed) {
    return (
      <div className="fv-gate-confirm">
        <AlertTriangleIcon size={48} className="fv-gate-confirm__icon" />
        <div className="fv-gate-confirm__body">
          <h3 className="fv-gate-confirm__title">Large file preview</h3>
          <p className="fv-gate-confirm__desc">{policy.message}</p>
          <p className="fv-gate-confirm__meta">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <div className="fv-gate-confirm__actions">
          <button className="fv-btn fv-btn--primary" onClick={() => setConfirmed(true)}>
            Preview anyway
          </button>
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

  // Warning (or confirmed): render the preview with a non-blocking banner.
  return (
    <>
      <div className="fv-gate-warning">
        <div className="fv-gate-warning__inner">
          <AlertTriangleIcon size={14} />
          <span>
            Large file: {formatFileSize(file.size)}. Preview may be slower.
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
