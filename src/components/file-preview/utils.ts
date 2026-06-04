import type { PreviewSource } from "./core/types";

export const ALL_FILE_TYPES = [
  "pdf",
  "markdown",
  "json",
  "code",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "html",
  "zip",
  "svg",
  "rtf",
  "epub",
  "image",
  "text",
  "csv",
  "video",
  "audio",
  "unknown",
] as const;

export type FileType = (typeof ALL_FILE_TYPES)[number];

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;

  /**
   * Primary source abstraction.
   *
   * Stage 18.0 makes source mandatory. Preview adapters should read
   * file data from this field via readSourceAsText/readSourceAsArrayBuffer.
   */
  source: PreviewSource;

  /**
   * @deprecated Use source + readSourceAsText/readSourceAsArrayBuffer instead.
   *
   * Temporary compatibility field for legacy preview components.
   * New code should not populate or depend on this field.
   */
  content?: string | null;

  /**
   * @deprecated Use source or adapter-local object URL instead.
   *
   * Temporary compatibility field for legacy media preview components.
   * New code should not populate or depend on this field.
   */
  url?: string | null;
}

const CODE_EXTENSIONS: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  toml: "toml",
  ini: "ini",
  dockerfile: "dockerfile",
  makefile: "makefile",
  r: "r",
  lua: "lua",
  dart: "dart",
  vue: "html",
  svelte: "html",
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "ico",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "avi"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function detectFileType(filename: string, mimeType: string): FileType {
  const ext = getFileExtension(filename);
  const baseName = filename.toLowerCase().split("/").pop() || "";

  // PDF
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";

  // Markdown
  if (["md", "mdx", "markdown"].includes(ext)) return "markdown";

  // JSON
  if (ext === "json" || mimeType === "application/json") return "json";

  // CSV
  if (ext === "csv" || mimeType === "text/csv") return "csv";

  // DOCX
  if (
    ext === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";

  // DOC (legacy Word format)
  if (ext === "doc" || mimeType === "application/msword")
    return "doc";

  // PPTX
  if (
    ext === "pptx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "pptx";

  // PPT (legacy PowerPoint binary format)
  if (ext === "ppt" || mimeType === "application/vnd.ms-powerpoint")
    return "ppt";

  // XLSX
  if (
    ext === "xlsx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "xlsx";

  // XLS (legacy Excel binary format)
  if (ext === "xls" || mimeType === "application/vnd.ms-excel")
    return "xls";

  // HTML
  if (["html", "htm", "xhtml"].includes(ext) || mimeType === "text/html")
    return "html";

  // SVG (separate from other images for enhanced preview)
  if (ext === "svg" || mimeType === "image/svg+xml") return "svg";

  // ZIP archives
  if (
    ext === "zip" ||
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  )
    return "zip";

  // RTF
  if (ext === "rtf" || mimeType === "application/rtf" || mimeType === "text/rtf")
    return "rtf";

  // EPUB
  if (ext === "epub" || mimeType === "application/epub+zip") return "epub";

  // Images (non-SVG)
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) return "image";

  // Videos
  if (VIDEO_EXTENSIONS.has(ext) || mimeType.startsWith("video/")) return "video";

  // Audio
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith("audio/")) return "audio";

  // Code files (check after HTML since .html/.vue/.svelte should be "html" type)
  if (CODE_EXTENSIONS[ext]) return "code";

  if (
    [
      "dockerfile",
      "makefile",
      "gnumakefile",
      "gemfile",
      "rakefile",
      "vagrantfile",
      ".gitignore",
      ".env",
      ".eslintrc",
      ".prettierrc",
    ].includes(baseName)
  )
    return "code";

  // YAML / XML get their own code highlighting but are still "code" type
  if (["yml", "yaml", "xml"].includes(ext)) return "code";

  // Text files
  if (
    mimeType.startsWith("text/") ||
    [
      "txt",
      "log",
      "conf",
      "cfg",
      "env",
      "gitignore",
      "eslintrc",
      "prettierrc",
    ].includes(ext)
  )
    return "text";

  return "unknown";
}

export function getLanguageFromFilename(filename: string): string {
  const ext = getFileExtension(filename);
  // Include HTML/Vue/Svelte here since they use code highlighter
  const codeExts: Record<string, string> = {
    ...CODE_EXTENSIONS,
    html: "html",
    htm: "html",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    vue: "html",
    svelte: "html",
  };
  return codeExts[ext] || "text";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

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

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Decode base64 string to Uint8Array.
 * Shared utility used by PDF, DOCX, DOC, PPTX, XLSX, EPUB, ZIP preview components.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
