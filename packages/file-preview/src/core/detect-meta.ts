/**
 * Unified file-metadata detection.
 *
 * `detectFileType(name, mimeType)` (in utils) is filename + MIME based —
 * fine when the user-provided metadata is honest, but real production
 * uploads fail those assumptions all the time:
 *
 *   - `report.pdf` renamed to `report.txt`
 *   - DOCX uploaded with `type: ""` (some upload widgets drop the MIME)
 *   - User picks the wrong file extension on save
 *   - Generic servers return `application/octet-stream` for everything
 *
 * `detectFileMeta(source)` looks at the actual bytes via {@link sniffMagic}
 * and {@link sniffZipContainer}, falls back to extension and MIME only when
 * the bytes are inconclusive, and tells the caller *how* it decided via
 * {@link FileMetaConfidence} and {@link FileMetaDetectBy}. That lets a
 * consumer know whether to trust the result enough to e.g. pick a renderer
 * over user-supplied claims.
 */

import { detectFileType, getFileExtension } from "../utils";
import type { FileType } from "../utils";
import type { PreviewSource } from "./types";
import { readSourceAsArrayBuffer, getSourceMimeType, getSourceName } from "./source";
import { sniffMagic, sniffZipContainer } from "./magic-bytes";

/**
 * How sure we are about the detection.
 *
 * - `"high"`   : magic bytes + (when relevant) ZIP container both matched.
 *                Filename and MIME are essentially irrelevant.
 * - `"medium"` : only the filename or MIME pointed at the result. Bytes
 *                were inconclusive (e.g. plain text, no signature).
 * - `"low"`    : neither bytes nor metadata matched — `unknown` fallback.
 */
export type FileMetaConfidence = "high" | "medium" | "low";

/** Which signal actually drove the answer. */
export type FileMetaDetectBy = "magic" | "container" | "extension" | "mime";

export interface FileMeta {
  fileType: FileType;
  /** Best-guess MIME, possibly synthesized from magic bytes. */
  mimeType: string;
  /** Detected filename (`source.name` for blob/buffer/url, `file.name` for File). */
  fileName: string;
  confidence: FileMetaConfidence;
  detectBy: FileMetaDetectBy;
}

export interface DetectFileMetaOptions {
  /**
   * Bytes to inspect. Capped to keep large files cheap — only the first
   * 32 bytes are needed for magic, and only ZIP-magic files trigger the
   * full container parse. Defaults to 64 KB, which is plenty.
   */
  maxBytesToInspect?: number;
}

const DEFAULT_INSPECT_LIMIT = 64 * 1024;
const FALLBACK_MIME = "application/octet-stream";

/**
 * Best-effort metadata for a `PreviewSource`.
 *
 * Resolution order:
 *
 *   1. Read up to `maxBytesToInspect` bytes from the source.
 *   2. {@link sniffMagic} on those bytes.
 *      - PDF / PNG / JPG / GIF / WebP / MP4 / OLE → high confidence; done.
 *      - ZIP → run {@link sniffZipContainer}: docx / pptx / xlsx / epub
 *        all read out as zip at the magic level.
 *   3. If neither matched (or jszip is missing), fall back to
 *      `detectFileType(name, mime)` over filename + source MIME, and
 *      mark confidence as `medium` (or `low` for `unknown`).
 *
 * The function never throws on a successful read — a bad source surfaces as
 * an `unknown` result with `confidence: "low"`. Read errors (e.g. URL fetch
 * failure when the source is `kind: "url"`) propagate, since the caller
 * can't get the bytes either way.
 */
export async function detectFileMeta(
  source: PreviewSource,
  options: DetectFileMetaOptions = {}
): Promise<FileMeta> {
  const fileName = getSourceName(source) ?? "";
  const declaredMime = getSourceMimeType(source) ?? "";
  const limit = options.maxBytesToInspect ?? DEFAULT_INSPECT_LIMIT;

  // Slice the source down to a small head — we only need 32 bytes for
  // most signatures, and 64 KB is well above the first central directory
  // record of even moderately large zips.
  const head = await readSourceHead(source, limit);

  // Layer 1: magic-byte sniff (sync, no peer deps).
  const magic = sniffMagic(head);

  // ZIP-magic: distinguish docx/pptx/xlsx/epub from a plain zip.
  if (magic.ext === "zip") {
    // JSZip needs the full archive (central directory is usually at the end),
    // not just the head bytes we used for cheap magic sniffing.
    const fullBuffer = await readSourceAsArrayBuffer(source);
    const container = await sniffZipContainer(fullBuffer);
    if (container) {
      // Strong signal: it's an OOXML or EPUB. The mime came straight from
      // the spec'd marker entry; confidence is high.
      return {
        fileType: detectFileType(fileName, container.mimeType),
        mimeType: container.mimeType,
        fileName,
        confidence: "high",
        detectBy: "container",
      };
    }
    // Plain zip: route through `detectFileType` so the registry resolves
    // `zip` correctly. The bytes-level signal is still strong.
    return {
      fileType: detectFileType(fileName, "application/zip"),
      mimeType: "application/zip",
      fileName,
      confidence: "high",
      detectBy: "magic",
    };
  }

  // Other matched magic: trust the bytes over the filename.
  if (magic.ext !== null && magic.mimeType !== null) {
    return {
      fileType: detectFileType(fileName, magic.mimeType),
      mimeType: magic.mimeType,
      fileName,
      confidence: "high",
      detectBy: "magic",
    };
  }

  // Layer 2: fall through to filename + MIME. This is where plain text /
  // markdown / code / csv / etc. resolve — none of them have magic
  // signatures, so we have to trust the filename or the declared MIME.
  const inferred = detectFileType(fileName, declaredMime);

  if (inferred !== "unknown") {
    // Prefer extension-driven decisions over MIME ones; `detectFileType`
    // internally weights extensions above MIME, so we mirror that here for
    // `detectBy`. If filename has no extension, attribute to MIME.
    const detectBy: FileMetaDetectBy = detectFileTypeByExtension(fileName) === inferred
      ? "extension"
      : "mime";
    return {
      fileType: inferred,
      // Only synthesize a MIME when the source didn't provide one; otherwise
      // pass through what the caller / browser told us.
      mimeType: declaredMime || FALLBACK_MIME,
      fileName,
      confidence: "medium",
      detectBy,
    };
  }

  // Nothing matched anywhere.
  return {
    fileType: "unknown",
    mimeType: declaredMime || FALLBACK_MIME,
    fileName,
    confidence: "low",
    detectBy: declaredMime ? "mime" : "extension",
  };
}

function detectFileTypeByExtension(fileName: string): FileType {
  const ext = getFileExtension(fileName);
  if (!ext) return "unknown";
  return detectFileType(fileName, "");
}

/**
 * Read up to `limit` bytes from a source, slicing first when possible.
 * Avoids loading huge files into memory just to peek at the header.
 */
async function readSourceHead(
  source: PreviewSource,
  limit: number
): Promise<ArrayBuffer> {
  // For File / Blob, slice first so we never load the rest. For URL we
  // can't (would require Range support); we fall through to the standard
  // reader and rely on the consumer setting a sensible source.
  if (source.kind === "file" || source.kind === "blob") {
    const blob = source.kind === "file" ? source.file : source.blob;
    return blob.slice(0, limit).arrayBuffer();
  }

  if (source.kind === "arrayBuffer") {
    return source.buffer.slice(0, Math.min(limit, source.buffer.byteLength));
  }

  // URL: no Range support; read the whole thing. Callers using URL sources
  // for detection should rely on processRemoteUrl's maxBytes cap instead.
  const buffer = await readSourceAsArrayBuffer(source);
  return buffer.slice(0, Math.min(limit, buffer.byteLength));
}
