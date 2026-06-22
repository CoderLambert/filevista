/**
 * @lamberl-lee/file-preview/full — full registry entry point.
 *
 * Imports every built-in plugin including heavy optional formats
 * (PDF, DOCX, PPTX, XLSX, RTF, ZIP, EPUB). Use this when your app
 * needs to preview every supported file type and you have installed
 * the relevant peer dependencies.
 *
 * Consumers that only need a subset should import individual plugins
 * from `@lamberl-lee/file-preview/plugins/<format>` instead, or
 * construct their own registry from the base set.
 */
export {
  builtinPreviewPlugins,
  createBuiltinPreviewRegistry,
  builtinPreviewPlugins as fullPreviewPlugins,
  createBuiltinPreviewRegistry as createFullPreviewRegistry,
} from "../plugins/builtin-plugins";

// Re-export individual heavy plugins so consumers using /full can still
// drop or replace specific formats.
export { pdfPlugin } from "../plugins/pdf-plugin";
export { docxPlugin } from "../plugins/docx-plugin";
export { pptxPlugin } from "../plugins/pptx-plugin";
export { xlsxPlugin } from "../plugins/xlsx-plugin";
export { rtfPlugin } from "../plugins/rtf-plugin";
export { zipPlugin } from "../plugins/zip-plugin";
export { epubPlugin } from "../plugins/epub-plugin";