/**
 * File preview size/line limits and related helpers.
 * Prevents Shiki from hanging or crashing on very large files.
 */

export const FILE_PREVIEW_LIMITS = {
  /** Skip Shiki highlighting above this byte size */
  SHIKI_MAX_FILE_SIZE: 500 * 1024, // 500 KB
  /** Skip Shiki highlighting above this line count */
  SHIKI_MAX_LINES: 5000,
  /** Skip code-block highlighting inside Markdown above this byte size */
  SHIKI_MAX_CODE_BLOCK_SIZE: 50 * 1024, // 50 KB
  /** Truncate display content to this size for plain-text fallback */
  MAX_DISPLAY_SIZE: 2 * 1024 * 1024, // 2 MB
} as const;

export function shouldHighlight(content: string): boolean {
  if (content.length > FILE_PREVIEW_LIMITS.SHIKI_MAX_FILE_SIZE) return false;
  const lines = content.split("\n").length;
  if (lines > FILE_PREVIEW_LIMITS.SHIKI_MAX_LINES) return false;
  return true;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateContent(content: string, maxSize: number = FILE_PREVIEW_LIMITS.MAX_DISPLAY_SIZE): string {
  if (content.length <= maxSize) return content;
  return content.slice(0, maxSize) + "\n\n... [内容已截断，仅显示前 " + formatFileSize(maxSize) + "]";
}
