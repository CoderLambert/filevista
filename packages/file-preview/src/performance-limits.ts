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
  maxBytes: number | null;
  actualBytes: number;
}

export interface PreviewSizePolicyConfig {
  maxBytes: number;
  warningBytes?: number | null;
  confirmBytes?: number | null;
}

export type LargeFilePolicy =
  | "default"
  | "off"
  | PreviewSizePolicyConfig;

export interface ResolvedPreviewSizePolicy {
  enabled: boolean;
  warningBytes: number | null;
  confirmBytes: number | null;
  maxBytes: number | null;
}

export function validatePreviewSizePolicy(
  policy: PreviewSizePolicyConfig,
): void {
  if (
    !Number.isFinite(policy.maxBytes) ||
    policy.maxBytes <= 0
  ) {
    throw new TypeError(
      "largeFilePolicy.maxBytes must be a positive finite number.",
    );
  }

  if (
    policy.warningBytes != null &&
    (!Number.isFinite(policy.warningBytes) || policy.warningBytes <= 0)
  ) {
    throw new TypeError(
      "largeFilePolicy.warningBytes must be a positive finite number.",
    );
  }

  if (
    policy.confirmBytes != null &&
    (!Number.isFinite(policy.confirmBytes) || policy.confirmBytes <= 0)
  ) {
    throw new TypeError(
      "largeFilePolicy.confirmBytes must be a positive finite number.",
    );
  }

  if (
    policy.warningBytes != null &&
    policy.confirmBytes != null &&
    policy.warningBytes >= policy.confirmBytes
  ) {
    throw new TypeError(
      "warningBytes must be smaller than confirmBytes.",
    );
  }

  if (
    policy.warningBytes != null &&
    policy.warningBytes >= policy.maxBytes
  ) {
    throw new TypeError(
      "warningBytes must be smaller than maxBytes.",
    );
  }

  if (
    policy.confirmBytes != null &&
    policy.confirmBytes >= policy.maxBytes
  ) {
    throw new TypeError(
      "confirmBytes must be smaller than maxBytes.",
    );
  }
}

export function resolvePreviewSizePolicy(
  policy: LargeFilePolicy = "default",
): ResolvedPreviewSizePolicy {
  if (policy === "off") {
    return {
      enabled: false,
      warningBytes: null,
      confirmBytes: null,
      maxBytes: null,
    };
  }

  if (policy === "default") {
    return {
      enabled: true,
      warningBytes: PREVIEW_SIZE_LIMITS.warning,
      confirmBytes: PREVIEW_SIZE_LIMITS.confirm,
      maxBytes: PREVIEW_SIZE_LIMITS.block,
    };
  }

  validatePreviewSizePolicy(policy);

  return {
    enabled: true,
    warningBytes: policy.warningBytes ?? null,
    confirmBytes: policy.confirmBytes ?? null,
    maxBytes: policy.maxBytes,
  };
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
  policy?: LargeFilePolicy;
}): PreviewSizePolicy {
  const resolved = resolvePreviewSizePolicy(
    input.policy ?? "default",
  );

  if (!resolved.enabled) {
    return {
      level: "normal",
      shouldWarn: false,
      shouldConfirm: false,
      shouldBlock: false,
      message: null,
      maxBytes: null,
      actualBytes: input.size,
    };
  }

  const { maxBytes, confirmBytes, warningBytes } = resolved;

  if (maxBytes !== null && input.size > maxBytes) {
    return {
      level: "block",
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: true,
      message:
        "This file is very large and may freeze the browser. Browser-side preview is disabled by default.",
      maxBytes,
      actualBytes: input.size,
    };
  }

  if (confirmBytes !== null && input.size >= confirmBytes) {
    return {
      level: "confirm",
      shouldWarn: true,
      shouldConfirm: true,
      shouldBlock: false,
      message:
        "This file is large and may take time to preview. Continue only if you trust the file and your browser has enough memory.",
      maxBytes,
      actualBytes: input.size,
    };
  }

  if (warningBytes !== null && input.size >= warningBytes) {
    return {
      level: "warning",
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: false,
      message:
        "This file is relatively large. Preview may be slower depending on your browser and device.",
      maxBytes,
      actualBytes: input.size,
    };
  }

  return {
    level: "normal",
    shouldWarn: false,
    shouldConfirm: false,
    shouldBlock: false,
    message: null,
    maxBytes,
    actualBytes: input.size,
  };
}
