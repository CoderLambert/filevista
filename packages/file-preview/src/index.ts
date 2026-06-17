/**
 * @filevista/file-preview — public API
 *
 * Quick start:
 *
 *   import { PluginPreviewRenderer, setAssetBasePath } from "@filevista/file-preview";
 *   import "@filevista/file-preview/styles/index.css";
 *
 *   setAssetBasePath("/static"); // where you serve PDF.js worker + RTF.js bundles
 *   <PluginPreviewRenderer file={fileInfo} />
 */

// ─── Top-level renderer ───────────────────────────────────────────────────
export {
  PluginPreviewRenderer,
  type PluginPreviewRendererProps,
} from "./PluginPreviewRenderer";

// ─── Core abstractions ────────────────────────────────────────────────────
export type {
  PreviewSource,
  NormalizedFile,
  FileType,
  FileInfo,
} from "./core/types";
export { ALL_FILE_TYPES } from "./core/types";
export type { PreviewPlugin } from "./core/plugin";
export {
  PreviewPluginRegistry,
  createPreviewPluginRegistry,
} from "./core/registry";

// Source utilities — read PreviewSource as text / ArrayBuffer / base64 / object URL.
export {
  readSourceAsArrayBuffer,
  readSourceAsText,
  readSourceAsBase64,
  createObjectUrlFromSource,
  getSourceName,
  getSourceMimeType,
  getSourceSize,
  type ReadSourceOptions,
} from "./core/source";
export {
  readBinaryPreviewAsArrayBuffer,
  readBinaryPreviewAsUint8Array,
  type BinaryPreviewInput,
} from "./core/binary";
export { downloadSource } from "./core/download";

// Runtime configuration — base path for static assets (PDF.js worker, RTF.js bundles).
export {
  setAssetBasePath,
  getAssetBasePath,
  resolveAssetPath,
} from "./core/config";

// Internationalization — locale messages + provider hook.
export {
  zhCN,
  enUS,
  LocaleProvider,
  useLocale,
  getDefaultLocale,
  type LocaleMessages,
} from "./core/i18n";

// ─── File detection ───────────────────────────────────────────────────────
export { detectFileType } from "./utils";

// Support matrix — which renderers cover which file types.
export {
  PREVIEW_SUPPORT_MATRIX,
  getPreviewSupportMeta,
  isPluginSupportedFileType,
  isUnsupportedFileType,
  isDegradedFileType,
  type PreviewSupportStatus,
  type PreviewSupportMeta,
  type RendererSupportState,
} from "./support-status";

// ─── Performance / size limits ────────────────────────────────────────────
export {
  PREVIEW_SIZE_LIMITS,
  getPreviewSizeLevel,
  getPreviewSizePolicy,
  type PreviewSizeLevel,
  type PreviewSizePolicy,
} from "./performance-limits";
export {
  XLSX_PREVIEW_LIMITS,
  FILE_PREVIEW_LIMITS,
  shouldHighlight,
  truncateContent,
} from "./limits";
export { LargeFileGate } from "./LargeFileGate";

// ─── Built-in plugins (full registry) ─────────────────────────────────────
export {
  builtinPreviewPlugins,
  createBuiltinPreviewRegistry,
} from "./plugins/builtin-plugins";

// Individual plugins — for custom registries that drop or replace formats.
export { audioPlugin } from "./plugins/audio-plugin";
export { csvPlugin } from "./plugins/csv-plugin";
export { docxPlugin } from "./plugins/docx-plugin";
export { epubPlugin } from "./plugins/epub-plugin";
export { htmlPlugin } from "./plugins/html-plugin";
export { imagePlugin } from "./plugins/image-plugin";
export { markdownPlugin } from "./plugins/markdown-plugin";
export { pdfPlugin } from "./plugins/pdf-plugin";
export { pptxPlugin } from "./plugins/pptx-plugin";
export { rtfPlugin } from "./plugins/rtf-plugin";
export { sourceCodePlugin } from "./plugins/source-code-plugin";
export { svgPlugin } from "./plugins/svg-plugin";
export { textPlugin } from "./plugins/text-plugin";
export { videoPlugin } from "./plugins/video-plugin";
export { xlsxPlugin } from "./plugins/xlsx-plugin";
export { zipPlugin } from "./plugins/zip-plugin";

// ─── Remote URL loader ────────────────────────────────────────────────────
export {
  processRemoteUrl,
  RemoteUrlError,
  type RemoteUrlErrorCode,
  type RemoteLoadProgress,
  type ProcessRemoteUrlOptions,
} from "./remote-url";

// ─── React hooks ──────────────────────────────────────────────────────────
export {
  useSourceText,
  type SourceTextState,
} from "./hooks/useSourceText";
export {
  useSourceBase64,
  type SourceBase64State,
} from "./hooks/useSourceBase64";
export { useObjectUrlFromSource } from "./hooks/useObjectUrlFromSource";
