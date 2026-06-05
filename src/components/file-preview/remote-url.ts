import { detectFileType, generateId } from "./utils";
import type { FileInfo } from "./utils";

export type RemoteUrlErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "NETWORK_OR_CORS"
  | "HTTP_ERROR"
  | "ABORTED"
  | "FILE_TOO_LARGE";

export class RemoteUrlError extends Error {
  constructor(
    public code: RemoteUrlErrorCode,
    message: string,
    public url?: string
  ) {
    super(message);
    this.name = "RemoteUrlError";
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
}

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

interface MagicSniffResult {
  ext: string | null;
  mimeType: string | null;
}

interface ContainerSniffResult {
  ext: string;
  mimeType: string;
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

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;

  return signature.every((value, index) => bytes[index] === value);
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function sniffMagic(buffer: ArrayBuffer): MagicSniffResult {
  const bytes = new Uint8Array(buffer.slice(0, 32));

  if (readAscii(bytes, 0, 5) === "%PDF-") {
    return {
      ext: "pdf",
      mimeType: "application/pdf",
    };
  }

  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return {
      ext: "zip",
      mimeType: "application/zip",
    };
  }

  if (
    startsWithBytes(bytes, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  ) {
    return {
      ext: "png",
      mimeType: "image/png",
    };
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return {
      ext: "jpg",
      mimeType: "image/jpeg",
    };
  }

  const gifHeader = readAscii(bytes, 0, 6);

  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return {
      ext: "gif",
      mimeType: "image/gif",
    };
  }

  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return {
      ext: "webp",
      mimeType: "image/webp",
    };
  }

  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    return {
      ext: "mp4",
      mimeType: "video/mp4",
    };
  }

  if (
    startsWithBytes(bytes, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ])
  ) {
    return {
      ext: "ole",
      mimeType: "application/x-ole-storage",
    };
  }

  return {
    ext: null,
    mimeType: null,
  };
}

async function sniffZipContainer(
  buffer: ArrayBuffer
): Promise<ContainerSniffResult | null> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);

    const fileNames = Object.keys(zip.files).map((name) =>
      name.replace(/\\/g, "/").toLowerCase()
    );

    const hasFile = (target: string) => fileNames.includes(target);

    if (hasFile("word/document.xml")) {
      return {
        ext: "docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }

    if (hasFile("ppt/presentation.xml")) {
      return {
        ext: "pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    }

    if (hasFile("xl/workbook.xml")) {
      return {
        ext: "xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    const mimetypeFile = zip.file("mimetype");

    if (mimetypeFile) {
      const mimetype = (await mimetypeFile.async("string")).trim();

      if (mimetype === "application/epub+zip") {
        return {
          ext: "epub",
          mimeType: "application/epub+zip",
        };
      }
    }

    return null;
  } catch {
    return null;
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
  options: ProcessRemoteUrlOptions
): Promise<ArrayBuffer> {
  const total = getContentLength(response);

  if (!response.body) {
    const buffer = await response.arrayBuffer();
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

  try {
    response = await fetch(parsedUrl.toString(), {
      signal: options.signal,
    });
  } catch (error) {
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

  const buffer = await readResponseAsArrayBufferWithProgress(response, options);

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
}
