/**
 * Magic-byte sniffers.
 *
 * Pulled out of `remote-url.ts` so both the remote-URL pipeline and the
 * synchronous `detectFileMeta` can share one source of truth for byte-level
 * format detection. Add a new format here, and every entry point that uses
 * detection picks it up automatically.
 *
 * The two layers:
 *
 *   1. `sniffMagic(buffer)`         — sync, reads the first ~32 bytes only.
 *                                     Cheap, deterministic, no peer deps.
 *   2. `sniffZipContainer(buffer)`  — async, loads the buffer through
 *                                     jszip and inspects the entry list to
 *                                     distinguish docx / pptx / xlsx / epub
 *                                     (all of which are zip files at the
 *                                     magic level). Requires the optional
 *                                     `jszip` peer; returns null if
 *                                     unavailable.
 */

export interface MagicSniffResult {
  /** Conventional extension (no leading dot), or null when no signature matched. */
  ext: string | null;
  /** MIME type for the matched signature, or null. */
  mimeType: string | null;
}

export interface ContainerSniffResult {
  ext: string;
  mimeType: string;
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/**
 * Inspect the first 32 bytes of `buffer` and identify the format by signature.
 *
 * Covered: PDF, ZIP (any of three local-file-header variants), PNG, JPEG, GIF
 * (87a/89a), WebP, MP4 (ISO BMFF "ftyp"), OLE compound (legacy doc/xls/ppt).
 *
 * For ZIP-based office formats (docx/pptx/xlsx/epub) `sniffMagic` returns
 * `ext: "zip"` — the caller must then run {@link sniffZipContainer} to
 * disambiguate. Keeping it two-layered lets the cheap sync path handle 90%
 * of files without paying jszip's load cost.
 */
export function sniffMagic(buffer: ArrayBuffer): MagicSniffResult {
  const bytes = new Uint8Array(buffer.slice(0, 32));

  if (readAscii(bytes, 0, 5) === "%PDF-") {
    return { ext: "pdf", mimeType: "application/pdf" };
  }

  // Three valid ZIP local-file-header variants. The first is by far the most
  // common; the latter two appear in spanned/empty zips but we still want to
  // recognize them.
  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return { ext: "zip", mimeType: "application/zip" };
  }

  if (
    startsWithBytes(bytes, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  ) {
    return { ext: "png", mimeType: "image/png" };
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { ext: "jpg", mimeType: "image/jpeg" };
  }

  const gifHeader = readAscii(bytes, 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { ext: "gif", mimeType: "image/gif" };
  }

  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return { ext: "webp", mimeType: "image/webp" };
  }

  // ISO Base Media File Format ("ftyp" at offset 4). Could be MP4, MOV, M4A,
  // 3GP, etc. — we report mp4 as the umbrella; finer-grained classification
  // would require parsing the major-brand box, which we don't need for the
  // current preview pipeline.
  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    return { ext: "mp4", mimeType: "video/mp4" };
  }

  // OLE2 compound document signature — legacy doc / xls / ppt all use this.
  // We report "ole" generically; the file type is then resolved from the
  // filename extension upstream (binary OLE distinguishes by stream layout
  // which we don't parse).
  if (
    startsWithBytes(bytes, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ])
  ) {
    return { ext: "ole", mimeType: "application/x-ole-storage" };
  }

  return { ext: null, mimeType: null };
}

/**
 * Look inside a ZIP buffer and tell which OOXML / EPUB format it actually is.
 *
 * - `word/document.xml`        → docx
 * - `ppt/presentation.xml`     → pptx
 * - `xl/workbook.xml`          → xlsx
 * - `mimetype` == `application/epub+zip` → epub
 *
 * Returns `null` when none of those marker entries are present (i.e. just a
 * plain zip), or when jszip can't be loaded / the buffer isn't a valid zip.
 */
export async function sniffZipContainer(
  buffer: ArrayBuffer
): Promise<ContainerSniffResult | null> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);

    // Path separators in zip entries are spec'd as forward slashes, but
    // Windows-built archives sometimes use backslashes. Normalize so
    // `hasFile` checks are reliable.
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
        return { ext: "epub", mimeType: "application/epub+zip" };
      }
    }

    return null;
  } catch {
    return null;
  }
}
