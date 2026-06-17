/**
 * Core types for the preview pipeline.
 *
 * Kept dependency-free so that {@link PreviewSource}, {@link NormalizedFile},
 * {@link FileInfo}, and the {@link FileType} union can be shared between the
 * runtime helpers in `utils.ts` and the plugin/registry layer without forming
 * a cycle.
 */

/**
 * Canonical file-type tags recognized by the built-in plugin registry.
 * Use {@link detectFileType} (in `utils`) to map a filename + MIME pair to one
 * of these values.
 */
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

/**
 * Source abstraction read by every preview plugin.
 *
 * Plugins should never touch raw `File`/`Blob`/`ArrayBuffer`/URL directly —
 * always go through `readSourceAsText` / `readSourceAsArrayBuffer` / the
 * matching React hooks. That keeps consumers free to mix local uploads,
 * blobs, decoded buffers, and remote URLs without each plugin re-deriving
 * the data path.
 */
export type PreviewSource =
  | {
      kind: "file";
      file: File;
    }
  | {
      kind: "blob";
      blob: Blob;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "arrayBuffer";
      buffer: ArrayBuffer;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "url";
      url: string;
      name?: string;
      mimeType?: string;
      headers?: Record<string, string>;
    };

/**
 * The shape consumers pass into `<PluginPreviewRenderer file={...} />`.
 *
 * `source` is the only field the plugin pipeline reads. The legacy `content`
 * and `url` fields exist for pre-Stage-18 callers and will be removed in a
 * future major.
 */
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;

  /**
   * Primary source abstraction. Mandatory in Stage 18+.
   * Read via `readSourceAsText` / `readSourceAsArrayBuffer` from `core/source`.
   */
  source: PreviewSource;

  /**
   * @deprecated Use `source` + `readSourceAsText`/`readSourceAsArrayBuffer`.
   * Compatibility field for legacy preview components.
   */
  content?: string | null;

  /**
   * @deprecated Use `source` or an adapter-local object URL.
   * Compatibility field for legacy media preview components.
   */
  url?: string | null;
}

/**
 * Slimmer normalized representation used by the registry / plugin internals.
 * Most consumers should work with {@link FileInfo} instead.
 */
export interface NormalizedFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  extension?: string;
  fileType: FileType;
  source: PreviewSource;
}
