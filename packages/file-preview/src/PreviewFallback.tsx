"use client";

import { useState } from "react";
import { AlertTriangleIcon, DownloadIcon, CopyIcon } from "./icons";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { downloadSource } from "./core/download";
import { useLocale } from "./core/i18n";
import "./styles/PreviewFallback.css";

export type PreviewFallbackKind =
  | "unsupported"
  | "plugin-load-failed"
  | "render-failed"
  | "source-read-failed"
  | "file-too-large"
  | "aborted"
  | "unknown";

export interface PreviewFallbackProps {
  kind: PreviewFallbackKind;
  file: FileInfo;
  title?: string;
  description?: string;
  error?: unknown;
  pluginId?: string;
  pluginName?: string;
  onRetry?: () => void;
  canDownload?: boolean;
}

function getFallbackTitle(kind: PreviewFallbackKind, t: ReturnType<typeof useLocale>): string {
  switch (kind) {
    case "unsupported":
      return t.previewNotAvailable;
    case "plugin-load-failed":
      return t.failedToLoadPreview;
    case "render-failed":
      return t.previewFailed;
    case "source-read-failed":
      return t.failedToReadFile;
    case "file-too-large":
      return t.largeFile;
    case "aborted":
      return t.loadingCancelled;
    default:
      return t.previewFailed;
  }
}

function getFallbackDescription(
  kind: PreviewFallbackKind,
  t: ReturnType<typeof useLocale>,
): string | undefined {
  switch (kind) {
    case "unsupported":
      return t.unsupportedFileType.replace("{fileType}", "");
    case "plugin-load-failed":
      return "The preview plugin could not be loaded. This may be a network issue or the plugin is not installed.";
    case "render-failed":
      return "The preview crashed while rendering. You can retry or download the original file.";
    case "source-read-failed":
      return "Could not read file content. The file may be corrupted or inaccessible.";
    case "file-too-large":
      return t.largeFileHint;
    case "aborted":
      return "File loading was cancelled.";
    default:
      return undefined;
  }
}

function PreviewErrorDetails({
  error,
  pluginId,
  pluginName,
  t,
}: {
  error?: unknown;
  pluginId?: string;
  pluginName?: string;
  t: ReturnType<typeof useLocale>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!error) return null;

  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

  return (
    <div className="fv-fallback__details">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="fv-fallback__details-toggle"
      >
        {expanded ? "Hide" : "Show"} {t.showErrorDetails.toLowerCase()}
      </button>

      {expanded && (
        <div className="fv-fallback__details-pre">
          {pluginName && `Plugin: ${pluginName}\n`}
          {pluginId && `ID: ${pluginId}\n`}
          {message}
          <button
            onClick={() => {
              const text = [
                pluginName && `Plugin: ${pluginName}`,
                pluginId && `ID: ${pluginId}`,
                message,
              ]
                .filter(Boolean)
                .join("\n");
              navigator.clipboard.writeText(text);
            }}
            className="fv-fallback__details-copy"
            title={t.copyCode}
          >
            <CopyIcon size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export function PreviewFallback({
  kind,
  file,
  title,
  description,
  error,
  pluginId,
  pluginName,
  onRetry,
  canDownload = true,
}: PreviewFallbackProps) {
  const t = useLocale();

  return (
    <div className="fv-fallback">
      <div className="fv-fallback__inner">
        <div className="fv-fallback__icon-wrap">
          <AlertTriangleIcon size={24} />
        </div>

        <div>
          <h3 className="fv-fallback__title">
            {title ?? getFallbackTitle(kind, t)}
          </h3>
          <p className="fv-fallback__desc">
            {description ?? getFallbackDescription(kind, t)}
          </p>
          <p className="fv-fallback__meta">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>

        <div className="fv-fallback__actions">
          {onRetry && (
            <button className="fv-btn fv-btn--primary fv-btn--sm" onClick={onRetry}>
              Retry
            </button>
          )}

          {canDownload && (
            <button
              className="fv-btn fv-btn--outline fv-btn--sm"
              onClick={() => downloadSource(file.source, file.name, file.type)}
            >
              <DownloadIcon size={16} /> {t.downloadOriginal}
            </button>
          )}
        </div>

        <PreviewErrorDetails
          error={error}
          pluginId={pluginId}
          pluginName={pluginName}
          t={t}
        />
      </div>
    </div>
  );
}
