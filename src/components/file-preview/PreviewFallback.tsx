"use client";

import { useState } from "react";
import { AlertTriangle, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { downloadSource } from "./core/download";

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
  const [expanded, setExpanded] = useState(
    () => process.env.NODE_ENV === "development",
  );

  if (!error) return null;

  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="mt-2 w-full max-w-sm space-y-1">
      {isDev && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          {expanded ? "Hide" : "Show"} error details
        </button>
      )}

      {(expanded || isDev) && (
        <div className="relative">
          <pre className="rounded-md bg-muted p-2 text-[10px] text-left overflow-auto max-h-32 whitespace-pre-wrap break-all">
            {pluginName && `Plugin: ${pluginName}\n`}
            {pluginId && `ID: ${pluginId}\n`}
            {message}
          </pre>
          {isDev && (
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
              className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-muted-foreground/20"
              title="Copy error details"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
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
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <div className="max-w-lg space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {title ?? getFallbackTitle(kind)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description ?? getFallbackDescription(kind)}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} size="sm">
              Retry
            </Button>
          )}

          {canDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSource(file.source, file.name, file.type)}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download original
            </Button>
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
