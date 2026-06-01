export type FileType =
  | "pdf"
  | "markdown"
  | "json"
  | "code"
  | "docx"
  | "pptx"
  | "image"
  | "text"
  | "csv"
  | "video"
  | "audio"
  | "unknown";

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;
  content: string | null; // base64 for binary, text for text files
  url: string | null; // object URL for binary files
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
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
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
  "svg",
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

  // PPTX / PPT
  if (
    ext === "pptx" ||
    ext === "ppt" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  )
    return "pptx";

  // Images
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) return "image";

  // Videos
  if (VIDEO_EXTENSIONS.has(ext) || mimeType.startsWith("video/")) return "video";

  // Audio
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith("audio/")) return "audio";

  // Code files
  if (CODE_EXTENSIONS[ext]) return "code";
  if (["Dockerfile", "Makefile", "Gemfile", "Rakefile"].includes(baseName))
    return "code";

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
  return CODE_EXTENSIONS[ext] || "text";
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
    pptx: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
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
    pptx: "PPT",
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
