/**
 * @lamberl-lee/file-preview — public API
 *
 * Quick start (base formats only — no heavy peer dependencies):
 *
 *   import { PluginPreviewRenderer, setAssetBasePath } from "@lamberl-lee/file-preview";
 *   import "@lamberl-lee/file-preview/styles/index.css";
 *
 *   setAssetBasePath("/static");
 *   <PluginPreviewRenderer file={fileInfo} />
 *
 * For heavy formats (PDF / DOCX / PPTX / XLSX / RTF / ZIP / EPUB) — install
 * the relevant peer dependencies and use the /full entry:
 *
 *   import {
 *     PluginPreviewRenderer,
 *   } from "@lamberl-lee/file-preview";
 *   import {
 *     createFullPreviewRegistry,
 *   } from "@lamberl-lee/file-preview/full";
 *
 *   const registry = createFullPreviewRegistry();
 *   <PluginPreviewRenderer file={fileInfo} registry={registry} />
 *
 * Or pick individual heavy plugins:
 *
 *   import { pptxPlugin } from "@lamberl-lee/file-preview/plugins/pptx";
 *   import { pdfPlugin }  from "@lamberl-lee/file-preview/plugins/pdf";
 */

// ─── Top-level renderer ───────────────────────────────────────────────────
export {
  PluginPreviewRenderer,
  type PluginPreviewRendererProps,
} from "./PluginPreviewRenderer";
export type {
  HtmlSecurityMode,
  HtmlTrustedPreviewRequest,
  HtmlTrustedPreviewRequestHandler,
} from "./HtmlPreview";

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
export {
  PreviewError,
  isPreviewError,
  normalizePreviewError,
  type PreviewErrorCode,
  type PreviewErrorOptions,
} from "./core/preview-error";

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
export {
  detectFileMeta,
  type FileMeta,
  type FileMetaConfidence,
  type FileMetaDetectBy,
  type DetectFileMetaOptions,
} from "./core/detect-meta";
export {
  sniffMagic,
  sniffZipContainer,
  type MagicSniffResult,
  type ContainerSniffResult,
} from "./core/magic-bytes";

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
  resolvePreviewSizePolicy,
  validatePreviewSizePolicy,
  getPreviewSizeLevel,
  getPreviewSizePolicy,
  type LargeFilePolicy,
  type PreviewSizePolicyConfig,
  type ResolvedPreviewSizePolicy,
  type PreviewSizeLevel,
  type PreviewSizePolicy,
} from "./performance-limits";
export {
  XLSX_PREVIEW_LIMITS,
  FILE_PREVIEW_LIMITS,
  shouldHighlight,
  truncateContent,
} from "./limits";
export {
  LargeFileGate,
  type LargeFileGateProps,
  type LargeFileBlockedContext,
} from "./LargeFileGate";

// ─── Built-in plugins (base only) ──────────────────────────────────────────
//
// The root entry only exports base (zero-optional-dependency) plugins so that
// `import { PluginPreviewRenderer } from "@lamberl-lee/file-preview"` never
// resolves heavy optional dependencies (PDF.js, JSZip, etc.) in the bundle
// graph.
//
// Heavy formats (PDF / DOCX / PPTX / XLSX / RTF / ZIP / EPUB) are available
// from sub-path exports:
//
//   import { createFullPreviewRegistry } from "@lamberl-lee/file-preview/full";
//   import { pptxPlugin }              from "@lamberl-lee/file-preview/plugins/pptx";
//   import { pdfPlugin }               from "@lamberl-lee/file-preview/plugins/pdf";
//   // …
export {
  basePreviewPlugins,
  createBasePreviewRegistry,
} from "./plugins/base-plugins";

// Individual base plugins — for custom registries that add or replace formats.
export { audioPlugin } from "./plugins/audio-plugin";
export { csvPlugin } from "./plugins/csv-plugin";
export { htmlPlugin } from "./plugins/html-plugin";
export { imagePlugin } from "./plugins/image-plugin";
export { markdownPlugin } from "./plugins/markdown-plugin";
export { sourceCodePlugin } from "./plugins/source-code-plugin";
export { svgPlugin } from "./plugins/svg-plugin";
export { textPlugin } from "./plugins/text-plugin";
export { videoPlugin } from "./plugins/video-plugin";

// ─── Remote URL loader ────────────────────────────────────────────────────
export {
  processRemoteUrl,
  createRemoteFileInfo,
  RemoteUrlError,
  DEFAULT_REMOTE_MAX_BYTES,
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
