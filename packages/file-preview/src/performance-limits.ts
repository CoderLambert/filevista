/**
 * Unified preview size policy for large files.
 * Defines thresholds for warning, confirmation, and blocking previews.
 */

import type { FileType } from "./utils";

export const PREVIEW_SIZE_LIMITS = {
  warning: 20 * 1024 * 1024,
  confirm: 50 * 1024 * 1024,
  block: 100 * 1024 * 1024,
} as const;

export type PreviewSizeLevel = "normal" | "warning" | "confirm" | "block";

export interface PreviewSizePolicy {
  level: PreviewSizeLevel;
  shouldWarn: boolean;
  shouldConfirm: boolean;
  shouldBlock: boolean;
  message: string | null;
}

export function getPreviewSizeLevel(size: number): PreviewSizeLevel {
  if (size >= PREVIEW_SIZE_LIMITS.block) return "block";
  if (size >= PREVIEW_SIZE_LIMITS.confirm) return "confirm";
  if (size >= PREVIEW_SIZE_LIMITS.warning) return "warning";
  return "normal";
}

export function getPreviewSizePolicy(input: {
  size: number;
  fileType?: FileType;
}): PreviewSizePolicy {
  const level = getPreviewSizeLevel(input.size);

  if (level === "block") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: true,
      message:
        "This file is very large and may freeze the browser. Browser-side preview is disabled by default.",
    };
  }

  if (level === "confirm") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: true,
      shouldBlock: false,
      message:
        "This file is large and may take time to preview. Continue only if you trust the file and your browser has enough memory.",
    };
  }

  if (level === "warning") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: false,
      message:
        "This file is relatively large. Preview may be slower depending on your browser and device.",
    };
  }

  return {
    level,
    shouldWarn: false,
    shouldConfirm: false,
    shouldBlock: false,
    message: null,
  };
}
