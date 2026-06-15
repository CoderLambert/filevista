import { useState } from "react";
import { AlertTriangleIcon, DownloadIcon, CopyIcon } from "./icons";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { downloadSource } from "./core/download";
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

function getFallbackTitle(kind: PreviewFallbackKind): string {
  switch (kind) {
    case "unsupported":
      return "Preview Not Available";
    case "plugin-load-failed":
      return "Failed to Load Preview";
    case "render-failed":
      return "Preview Crashed";
    case "source-read-failed":
      return "Failed to Read File";
    case "file-too-large":
      return "File Too Large";
    case "aborted":
      return "Loading Cancelled";
    default:
      return "Something Went Wrong";
  }
}

function getFallbackDescription(
  kind: PreviewFallbackKind,
): string | undefined {
  switch (kind) {
    case "unsupported":
      return "This file type is currently not available for browser-side preview.";
    case "plugin-load-failed":
      return "The preview plugin could not be loaded. This may be a network issue or the plugin is not installed.";
    case "render-failed":
      return "The preview crashed while rendering. You can retry or download the original file.";
    case "source-read-failed":
      return "Could not read file content. The file may be corrupted or inaccessible.";
    case "file-too-large":
      return "This file exceeds the preview size limit and cannot be rendered in the browser.";
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
}: {
  error?: unknown;
  pluginId?: string;
  pluginName?: string;
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
        {expanded ? "Hide" : "Show"} error details
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
            title="Copy error details"
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
  return (
    <div className="fv-fallback">
      <div className="fv-fallback__inner">
        <div className="fv-fallback__icon-wrap">
          <AlertTriangleIcon size={24} />
        </div>

        <div>
          <h3 className="fv-fallback__title">
            {title ?? getFallbackTitle(kind)}
          </h3>
          <p className="fv-fallback__desc">
            {description ?? getFallbackDescription(kind)}
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
              <DownloadIcon size={16} /> Download original
            </button>
          )}
        </div>

        <PreviewErrorDetails
          error={error}
          pluginId={pluginId}
          pluginName={pluginName}
        />
      </div>
    </div>
  );
}
