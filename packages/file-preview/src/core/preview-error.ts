export type PreviewErrorCode =
  | "MISSING_PEER_DEPENDENCY"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "REMOTE_CORS_ERROR"
  | "REMOTE_HTTP_ERROR"
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "ABORTED"
  | "PARSE_FAILED"
  | "RENDER_FAILED"
  | "SECURITY_BLOCKED";

export interface PreviewErrorOptions {
  cause?: unknown;
  url?: string;
  pluginId?: string;
  pluginName?: string;
  fileName?: string;
  details?: Record<string, unknown>;
}

/**
 * Stable, SDK-facing error shape.
 *
 * Messages can change as UX improves; `code` is the contract consumers should
 * switch on for telemetry, retry policy, and custom fallback UI.
 */
export class PreviewError extends Error {
  readonly code: PreviewErrorCode;
  readonly cause?: unknown;
  readonly url?: string;
  readonly pluginId?: string;
  readonly pluginName?: string;
  readonly fileName?: string;
  readonly details?: Record<string, unknown>;

  constructor(code: PreviewErrorCode, message: string, options: PreviewErrorOptions = {}) {
    super(message);
    this.name = "PreviewError";
    this.code = code;
    this.cause = options.cause;
    this.url = options.url;
    this.pluginId = options.pluginId;
    this.pluginName = options.pluginName;
    this.fileName = options.fileName;
    this.details = options.details;
  }
}

export function isPreviewError(error: unknown): error is PreviewError {
  return error instanceof PreviewError;
}

export function normalizePreviewError(
  error: unknown,
  fallback: {
    code: PreviewErrorCode;
    message: string;
    pluginId?: string;
    pluginName?: string;
    fileName?: string;
  }
): PreviewError {
  if (error instanceof PreviewError) return error;

  if (error instanceof Error) {
    return new PreviewError(fallback.code, error.message || fallback.message, {
      cause: error,
      pluginId: fallback.pluginId,
      pluginName: fallback.pluginName,
      fileName: fallback.fileName,
    });
  }

  return new PreviewError(fallback.code, fallback.message, {
    cause: error,
    pluginId: fallback.pluginId,
    pluginName: fallback.pluginName,
    fileName: fallback.fileName,
  });
}
