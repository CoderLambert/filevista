/**
 * Local helpers for the playground demo app.
 *
 * These small utilities used to live in `@filevista/file-preview`'s public
 * surface, but were demoted to internals in the 0.1 API tightening — they
 * encode app-level UI conventions (Tailwind palette, label casing) rather
 * than library logic. The library still owns `detectFileType` and the
 * `FileType` union; everything below is local glue.
 */

import type { FileType } from "@filevista/file-preview";

/** Format byte count as "1.23 MB" / "456 KB" / etc. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/** Generate a short non-cryptographic id for demo file entries. */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/** Decode a base64 string into a Uint8Array — used by demo binary fixtures. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Tailwind badge classes per file type — playground UI convention. */
export function getFileTypeColor(fileType: FileType): string {
  const colors: Record<FileType, string> = {
    pdf: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    markdown: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    json: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    code: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    docx: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    doc: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    pptx: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    ppt: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    xlsx: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    xls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    html: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    zip: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    svg: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    rtf: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    epub: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    image: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    text: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    csv: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    video: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    audio: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    unknown: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return colors[fileType];
}

/** Human-readable label per file type — playground UI convention. */
export function getFileTypeLabel(fileType: FileType): string {
  const labels: Record<FileType, string> = {
    pdf: "PDF",
    markdown: "Markdown",
    json: "JSON",
    code: "Code",
    docx: "Word",
    doc: "Word",
    pptx: "PPT",
    ppt: "PPT",
    xlsx: "Excel",
    xls: "Excel",
    html: "HTML",
    zip: "ZIP",
    svg: "SVG",
    rtf: "RTF",
    epub: "EPUB",
    image: "Image",
    text: "Text",
    csv: "CSV",
    video: "Video",
    audio: "Audio",
    unknown: "Unknown",
  };
  return labels[fileType];
}
