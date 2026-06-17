/**
 * Excel preview — image/media helper utilities.
 *
 * Moved from XlsxPreview.tsx to enable reuse across table and
 * (future) spreadsheet image overlay layers.
 */

export type ImageFormat = "png" | "jpeg" | "gif" | "bmp" | "emf" | "wmf" | "tiff" | "webp" | "svg" | "unknown";

export const BROWSER_SUPPORTED_FORMATS = new Set(["png", "jpeg", "gif", "bmp", "webp", "svg"]);

/**
 * Parse image dimensions from raw bytes without full decoding.
 * Supports PNG, JPEG, GIF, and BMP.
 */
export function parseImageDimensions(buffer: any): { width: number; height: number } {
  const bytes = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer)
    : new Uint8Array(Buffer.from(buffer));
  if (bytes.length < 10) return { width: 0, height: 0 };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes.length > 24) {
    return { width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] };
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    for (let i = 0; i < Math.min(bytes.length - 9, 65536); i++) {
      if (bytes[i] === 0xFF) {
        const m = bytes[i + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
        }
      }
    }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4D && bytes.length > 25) {
    return { width: bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24), height: bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24) };
  }
  return { width: 0, height: 0 };
}

/**
 * Detect image format from magic bytes.
 */
export function detectImageFormat(buffer: any): ImageFormat {
  const bytes = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer)
    : new Uint8Array(Buffer.from(buffer));
  if (bytes.length < 4) return "unknown";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return "bmp";
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A) || (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00)) return "tiff";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x00 && bytes.length > 44) return "emf";
  if ((bytes[0] === 0xD7 && bytes[1] === 0xCD && bytes[2] === 0xC6 && bytes[3] === 0x9A) || (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x09 && bytes[3] === 0x00)) return "wmf";
  return "unknown";
}

/**
 * Map an ImageFormat to its MIME type string.
 */
export function getMimeType(format: ImageFormat): string {
  const map: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", tiff: "image/tiff" };
  return map[format] || "image/png";
}

/**
 * Convert a buffer (Uint8Array, ArrayBuffer, or Buffer) to a base64 string.
 * Processes in 8KB chunks for memory efficiency.
 */
export function bufferToBase64(buf: any): string {
  if (buf instanceof Uint8Array || buf instanceof ArrayBuffer) {
    const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < arr.length; i += 8192) {
      const chunk = arr.subarray(i, Math.min(i + 8192, arr.length));
      bin += String.fromCharCode(...chunk);
    }
    return btoa(bin);
  }
  if (typeof buf === "string") return buf;
  return (buf as any).toString("base64");
}
