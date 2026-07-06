"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, DownloadIcon } from "./icons";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { getPreviewSizePolicy, type LargeFilePolicy } from "./performance-limits";
import { PreviewFallback } from "./PreviewFallback";
import { PreviewError } from "./core/preview-error";
import { safelyInvoke } from "./core/safely-invoke";
import { useLocale } from "./core/i18n";
import { downloadSource } from "./core/download";
import "./styles/LargeFileGate.css";

export interface LargeFileBlockedContext {
  file: FileInfo;
  actualBytes: number;
  maxBytes: number;
  download: () => Promise<void>;
}

export interface LargeFileGateProps {
  file: FileInfo;
  children: React.ReactNode;
  policy?: LargeFilePolicy;
  /**
   * Bypass the gate entirely and render children as-is.
   *
   * Useful when a consumer wants to manage large-file policy themselves
   * (or disable it for trusted, internal-only previews). The default
   * `PluginPreviewRenderer` already applies this gate, so most consumers
   * never instantiate `LargeFileGate` directly.
   *
   * `disabled=true` is equivalent to `policy="off"`.
   */
  disabled?: boolean;
  onError?: (error: PreviewError) => void;
  renderBlockedFallback?: (
    context: LargeFileBlockedContext,
  ) => React.ReactNode;
}

/**
 * Self-contained large-file gate.
 *
 * Wraps a preview and, based on `file.size` and the configured `policy`,
 * shows:
 *   - a non-blocking "may be slower" banner above the preview (warning)
 *   - a confirm prompt (user must click "Preview anyway")
 *   - blocks preview entirely, offers download only (block)
 *
 * The confirm state is internal and resets when `file.id` changes, so the
 * gate is a drop-in wrapper — no external state plumbing required.
 *
 * Thresholds live in `PREVIEW_SIZE_LIMITS` and can be overridden via the
 * `policy` prop (see `PreviewSizePolicyConfig`).
 */
export function LargeFileGate({
  file,
  children,
  policy,
  disabled = false,
  onError,
  renderBlockedFallback,
}: LargeFileGateProps) {
  const [confirmed, setConfirmed] = useState(false);
  const t = useLocale();

  // Reset the confirm decision whenever the user switches to a different
  // file — confirming one large file must not auto-confirm the next.
  useEffect(() => {
    setConfirmed(false);
  }, [file.id]);

  const resolvedPolicy = disabled ? "off" : policy;

  const sizePolicy = getPreviewSizePolicy({
    size: file.size,
    fileType: file.fileType,
    policy: resolvedPolicy,
  });

  // Avoid duplicate reports for the same file. Keyed on `file.id` plus
  // `size`/`name` so that a caller reusing the same id for a different
  // file (a contract violation, but a survivable one) still re-reports.
  const blockReportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sizePolicy.shouldBlock) {
      blockReportedRef.current = null;
      return;
    }

    const reportKey = `${file.id}::${file.size}::${file.name}`;
    if (blockReportedRef.current === reportKey) return;
    blockReportedRef.current = reportKey;

    safelyInvoke(
      onError,
      new PreviewError(
        "FILE_TOO_LARGE",
        "File exceeds the configured preview limit.",
        {
          fileName: file.name,
          details: {
            actualBytes: file.size,
            maxBytes: sizePolicy.maxBytes,
            fileType: file.fileType,
          },
        },
      ),
    );
  }, [
    file.id,
    file.name,
    file.size,
    file.fileType,
    onError,
    sizePolicy.shouldBlock,
    sizePolicy.maxBytes,
  ]);

  if (disabled || !sizePolicy.shouldWarn) {
    return <>{children}</>;
  }

  // Block: never render the preview, only offer download.
  if (sizePolicy.shouldBlock) {
    const fallbackContext: LargeFileBlockedContext = {
      file,
      actualBytes: file.size,
      maxBytes: sizePolicy.maxBytes!,
      download: () =>
        downloadSource(file.source, file.name, file.type),
    };

    if (renderBlockedFallback) {
      return <>{renderBlockedFallback(fallbackContext)}</>;
    }

    return (
      <PreviewFallback
        kind="file-too-large"
        file={file}
        description={t.fileTooLargeBlockedDesc
          .replace("{actualSize}", formatFileSize(file.size))
          .replace("{maxSize}", formatFileSize(sizePolicy.maxBytes!))}
        canDownload
      />
    );
  }

  // Confirm: require an explicit "Preview anyway" before rendering.
  if (sizePolicy.shouldConfirm && !confirmed) {
    return (
      <div className="fv-gate-confirm">
        <AlertTriangleIcon size={48} className="fv-gate-confirm__icon" />
        <div className="fv-gate-confirm__body">
          <h3 className="fv-gate-confirm__title">{t.largeFilePreviewTitle}</h3>
          <p className="fv-gate-confirm__desc">{sizePolicy.message}</p>
          <p className="fv-gate-confirm__meta">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <div className="fv-gate-confirm__actions">
          <button className="fv-btn fv-btn--primary" onClick={() => setConfirmed(true)}>
            {t.previewAnyway}
          </button>
          <button
            className="fv-btn fv-btn--outline"
            onClick={() => downloadSource(file.source, file.name, file.type)}
          >
            <DownloadIcon size={16} /> {t.download}
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
            {t.largeFileWarningBanner.replace(
              "{fileSize}",
              formatFileSize(file.size),
            )}
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
