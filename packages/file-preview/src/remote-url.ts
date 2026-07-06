import { detectFileType, generateId } from "./utils";
import type { FileInfo } from "./utils";
import { sniffMagic, sniffZipContainer } from "./core/magic-bytes";
import { PreviewError, type PreviewErrorCode } from "./core/preview-error";

export type RemoteUrlErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "NETWORK_OR_CORS"
  | "HTTP_ERROR"
  | "ABORTED"
  | "FILE_TOO_LARGE";

function mapRemoteUrlErrorCode(code: RemoteUrlErrorCode): PreviewErrorCode {
  switch (code) {
    case "NETWORK_OR_CORS":
      return "REMOTE_CORS_ERROR";
    case "HTTP_ERROR":
      return "REMOTE_HTTP_ERROR";
    default:
      return code;
  }
}

export class RemoteUrlError extends PreviewError {
  readonly remoteCode: RemoteUrlErrorCode;

  constructor(
    code: RemoteUrlErrorCode,
    message: string,
    url?: string
  ) {
    super(mapRemoteUrlErrorCode(code), message, {
      url,
      details: { remoteCode: code },
    });
    this.name = "RemoteUrlError";
    this.remoteCode = code;
  }
}

export interface RemoteLoadProgress {
  received: number;
  total: number | null;
  percent: number | null;
}

export interface ProcessRemoteUrlOptions {
  signal?: AbortSignal;
  onProgress?: (progress: RemoteLoadProgress) => void;
  /**
   * Maximum bytes to download from the remote URL.
   *
   * Defaults to 100 MB. If the server advertises a `Content-Length` above
   * this, the download is rejected before any bytes are transferred. If the
   * server omits `Content-Length`, the download is aborted mid-stream the
   * moment `received` crosses the limit — so an unbounded response can never
   * exhaust browser memory.
   *
   * On either path the rejection is a `RemoteUrlError` with code
   * `FILE_TOO_LARGE`. Set to `Infinity` to disable the limit entirely.
   */
  maxBytes?: number;
}

/** Default remote download cap. Overridable via `ProcessRemoteUrlOptions.maxBytes`. */
export const DEFAULT_REMOTE_MAX_BYTES = 100 * 1024 * 1024;

type FileNameSource =
  | "content-disposition"
  | "query"
  | "pathname"
  | "fallback";

type MimeDetectionSource =
  | "container"
  | "magic"
  | "extension"
  | "header"
  | "fallback";

interface FileNameResult {
  fileName: string;
  source: FileNameSource;
}

interface MimeResult {
  mimeType: string;
  source: MimeDetectionSource;
}

const REMOTE_MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",

  pdf: "application/pdf",
  zip: "application/zip",
  epub: "application/epub+zip",

  json: "application/json",
  csv: "text/csv",
  md: "text/markdown",
  mdx: "text/markdown",
  html: "text/html",
  htm: "text/html",
  svg: "image/svg+xml",

  txt: "text/plain",
  log: "text/plain",

  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",

  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",

  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
};

const GENERIC_MIME_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-msdownload",
  "application/download",
]);

const WEAK_MAGIC_MIME_TYPES = new Set([
  "application/zip",
  "application/x-ole-storage",
  "video/mp4",
]);

function isStrongMagicMimeType(mimeType: string | null): boolean {
  return Boolean(mimeType && !WEAK_MAGIC_MIME_TYPES.has(mimeType));
}

function sanitizeRemoteFileName(fileName: string): string {
  const cleanName = fileName
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName || "remote-file";
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getExtension(fileName: string): string {
  const cleanName = fileName.split("?")[0].split("#")[0];
  const parts = cleanName.toLowerCase().split(".");

  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function normalizeHeaderMimeType(headerMimeType: string): string {
  const mimeType = headerMimeType.split(";")[0]?.trim().toLowerCase() || "";

  return GENERIC_MIME_TYPES.has(mimeType) ? "" : mimeType;
}

function getHeaderMimeType(response: Response): string {
  return response.headers.get("content-type")?.split(";")[0]?.trim() || "";
}

function getFileNameFromContentDisposition(
  contentDisposition?: string | null
): string | null {
  if (!contentDisposition) return null;

  const filenameStarMatch = contentDisposition.match(
    /filename\*\s*=\s*([^;]+)/i
  );

  if (filenameStarMatch?.[1]) {
    const rawValue = stripQuotes(filenameStarMatch[1]);

    const rfc5987Match = rawValue.match(/^[^']*'[^']*'(.+)$/);
    const encodedValue = rfc5987Match?.[1] || rawValue;

    return sanitizeRemoteFileName(tryDecodeURIComponent(encodedValue));
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);

  if (filenameMatch?.[1]) {
    return sanitizeRemoteFileName(
      tryDecodeURIComponent(stripQuotes(filenameMatch[1]))
    );
  }

  return null;
}

function getRemoteFileName(
  rawUrl: string,
  contentDisposition?: string | null
): FileNameResult {
  const fromDisposition = getFileNameFromContentDisposition(contentDisposition);

  if (fromDisposition) {
    return {
      fileName: fromDisposition,
      source: "content-disposition",
    };
  }

  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;

    const queryKeys = [
      "showname",
      "filename",
      "fileName",
      "name",
      "file",
      "download",
    ];

    let firstQueryCandidate: string | null = null;

    for (const key of queryKeys) {
      const value = params.get(key)?.trim();

      if (!value || value.toLowerCase() === "true") {
        continue;
      }

      const candidate = sanitizeRemoteFileName(value);

      if (!firstQueryCandidate) {
        firstQueryCandidate = candidate;
      }

      if (getExtension(candidate)) {
        return {
          fileName: candidate,
          source: "query",
        };
      }
    }

    const pathname = decodeURIComponent(url.pathname);
    const pathnameName = pathname.split("/").filter(Boolean).pop();

    if (pathnameName?.trim()) {
      const candidate = sanitizeRemoteFileName(pathnameName.trim());

      if (getExtension(candidate)) {
        return {
          fileName: candidate,
          source: "pathname",
        };
      }
    }

    if (firstQueryCandidate) {
      return {
        fileName: firstQueryCandidate,
        source: "query",
      };
    }

    if (pathnameName?.trim()) {
      return {
        fileName: sanitizeRemoteFileName(pathnameName.trim()),
        source: "pathname",
      };
    }

    return {
      fileName: "remote-file",
      source: "fallback",
    };
  } catch {
    return {
      fileName: "remote-file",
      source: "fallback",
    };
  }
}


function resolveRemoteMimeType(input: {
  fileName: string;
  headerMimeType: string;
  magicMimeType: string | null;
  containerMimeType: string | null;
}): MimeResult {
  const ext = getExtension(input.fileName);
  const mimeFromExtension = REMOTE_MIME_BY_EXTENSION[ext];
  const mimeFromHeader = normalizeHeaderMimeType(input.headerMimeType);

  // 1. ZIP internal container (docx/pptx/xlsx/epub)
  if (input.containerMimeType) {
    return {
      mimeType: input.containerMimeType,
      source: "container",
    };
  }

  // 2. Strong magic (PDF/PNG/JPG/GIF/WEBP)
  if (isStrongMagicMimeType(input.magicMimeType)) {
    return {
      mimeType: input.magicMimeType!,
      source: "magic",
    };
  }

  // 3. Explicit extension wins over weak magic (zip/ole/ftyp)
  if (mimeFromExtension) {
    return {
      mimeType: mimeFromExtension,
      source: "extension",
    };
  }

  // 4. Content-Type header
  if (mimeFromHeader) {
    return {
      mimeType: mimeFromHeader,
      source: "header",
    };
  }

  // 5. Weak magic as last resort before fallback
  if (input.magicMimeType) {
    return {
      mimeType: input.magicMimeType,
      source: "magic",
    };
  }

  return {
    mimeType: "application/octet-stream",
    source: "fallback",
  };
}

function getContentLength(response: Response): number | null {
  const value = response.headers.get("content-length");
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readResponseAsArrayBufferWithProgress(
  response: Response,
  options: ProcessRemoteUrlOptions,
  url: string
): Promise<ArrayBuffer> {
  const total = getContentLength(response);
  const maxBytes = options.maxBytes ?? DEFAULT_REMOTE_MAX_BYTES;

  // Pre-flight: if the server tells us up front the file is too big, refuse
  // before allocating any memory or transferring the body.
  if (total !== null && total > maxBytes) {
    throw new RemoteUrlError(
      "FILE_TOO_LARGE",
      `Remote file is ${total} bytes, exceeds the ${maxBytes}-byte limit.`,
      url
    );
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new RemoteUrlError(
        "FILE_TOO_LARGE",
        `Remote file is ${buffer.byteLength} bytes, exceeds the ${maxBytes}-byte limit.`,
        url
      );
    }
    options.onProgress?.({
      received: buffer.byteLength,
      total,
      percent: total ? buffer.byteLength / total : null,
    });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      if (options.signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const { done, value } = await reader.read();

      if (done) break;

      if (value) {
        chunks.push(value);
        received += value.byteLength;

        // No Content-Length (or a lying one): abort as soon as we cross the
        // cap so an unbounded stream can't drain memory.
        if (received > maxBytes) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          throw new RemoteUrlError(
            "FILE_TOO_LARGE",
            `Remote file exceeded the ${maxBytes}-byte limit after ${received} bytes (no reliable Content-Length).`,
            url
          );
        }

        options.onProgress?.({
          received,
          total,
          percent: total ? received / total : null,
        });
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

/**
 * Build a `FileInfo` for a remote URL using metadata the caller already has
 * (e.g. a backend file listing that returns `name` + `size` without downloading
 * the body).
 *
 * Unlike {@link processRemoteUrl}, this does NOT fetch — the size is taken
 * from the caller-supplied metadata, so `LargeFileGate` can apply warning /
 * confirm / block thresholds before any network traffic starts. The download
 * happens lazily, when a preview plugin calls `readSourceAsArrayBuffer(source)`
 * / `readSourceAsText(source)`.
 *
 * Trade-offs vs `processRemoteUrl`:
 *   - MIME type comes from `mimeType` (or empty) — no magic-byte sniffing.
 *     Pass `mimeType` if the backend knows it.
 *   - No `onProgress` download callback.
 *   - No built-in 100 MB hard cap — caller controls via `largeFilePolicy.maxBytes`.
 *   - Network/CORS errors surface as plain `Error` from `readSourceAsArrayBuffer`,
 *     not the typed `RemoteUrlError` you'd get from `processRemoteUrl`.
 */
export function createRemoteFileInfo(input: {
  name: string;
  size: number;
  url: string;
  mimeType?: string;
  headers?: Record<string, string>;
  /**
   * Stable identifier. Defaults to `${name}::${size}` — pass a real id if your
   * backend has one, since name+size can collide across revisions or directories.
   */
  id?: string;
}): FileInfo {
  const mimeType = input.mimeType ?? "";
  return {
    id: input.id ?? `${input.name}::${input.size}`,
    name: input.name,
    size: input.size,
    type: mimeType,
    fileType: detectFileType(input.name, mimeType),
    source: {
      kind: "url",
      url: input.url,
      name: input.name,
      mimeType: mimeType || undefined,
      headers: input.headers,
    },
  };
}

export async function processRemoteUrl(
  rawUrl: string,
  options: ProcessRemoteUrlOptions = {}
): Promise<FileInfo> {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl) {
    throw new RemoteUrlError("INVALID_URL", "Remote URL is empty");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new RemoteUrlError("INVALID_URL", "Please enter a valid URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new RemoteUrlError(
      "UNSUPPORTED_PROTOCOL",
      "Only http/https URLs are supported",
      parsedUrl.toString()
    );
  }

  let response: Response;
  let buffer: ArrayBuffer;

  try {
    response = await fetch(parsedUrl.toString(), {
      signal: options.signal,
    });

    if (!response.ok) {
      throw new RemoteUrlError(
        "HTTP_ERROR",
        `远程文件请求失败：HTTP ${response.status}`,
        parsedUrl.toString()
      );
    }

    const headerMimeType = getHeaderMimeType(response);
    const contentDisposition = response.headers.get("content-disposition");

    const fileNameResult = getRemoteFileName(
      parsedUrl.toString(),
      contentDisposition
    );

    buffer = await readResponseAsArrayBufferWithProgress(
      response,
      options,
      parsedUrl.toString()
    );

    const magicResult = sniffMagic(buffer);

    const containerResult =
      magicResult.ext === "zip" ? await sniffZipContainer(buffer) : null;

    const mimeResult = resolveRemoteMimeType({
      fileName: fileNameResult.fileName,
      headerMimeType,
      magicMimeType: magicResult.mimeType,
      containerMimeType: containerResult?.mimeType ?? null,
    });

    const fileType = detectFileType(fileNameResult.fileName, mimeResult.mimeType);

    return {
      id: generateId(),
      name: fileNameResult.fileName,
      size: buffer.byteLength,
      type: mimeResult.mimeType,
      fileType,
      source: {
        kind: "arrayBuffer",
        buffer,
        name: fileNameResult.fileName,
        mimeType: mimeResult.mimeType,
      },
    };
  } catch (error) {
    if (error instanceof RemoteUrlError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RemoteUrlError(
        "ABORTED",
        "Remote file loading cancelled",
        parsedUrl.toString()
      );
    }

    throw new RemoteUrlError(
      "NETWORK_OR_CORS",
      "无法加载远程文件。可能是 URL 不可访问，或目标服务器未允许浏览器跨域访问。",
      parsedUrl.toString()
    );
  }
}
