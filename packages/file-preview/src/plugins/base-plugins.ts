import { createPreviewPluginRegistry, type PreviewPluginRegistry } from "../core/registry";
import type { PreviewPlugin } from "../core/plugin";
import { imagePlugin } from "./image-plugin";
import { sourceCodePlugin } from "./source-code-plugin";
import { textPlugin } from "./text-plugin";
import { audioPlugin } from "./audio-plugin";
import { videoPlugin } from "./video-plugin";
import { svgPlugin } from "./svg-plugin";
import { csvPlugin } from "./csv-plugin";
import { markdownPlugin } from "./markdown-plugin";
import { htmlPlugin } from "./html-plugin";

/**
 * Base preview plugins — these require zero optional peer dependencies.
 *
 * Only file types that depend solely on first-party code or the core
 * `dependencies` (shiki, react-markdown, dompurify) are included here.
 *
 * Heavy formats (PDF, DOCX, PPTX, XLSX, RTF, ZIP, EPUB) are NOT included;
 * register them manually or import `createFullPreviewRegistry()` from
 * `@lamberl-lee/file-preview/full`.
 *
 * @see builtinPreviewPlugins for the full set including opt-in heavy formats.
 */
export const basePreviewPlugins: PreviewPlugin[] = [
  sourceCodePlugin,
  textPlugin,
  imagePlugin,
  audioPlugin,
  videoPlugin,
  svgPlugin,
  csvPlugin,
  markdownPlugin,
  htmlPlugin,
];

/**
 * Create a plugin registry that only contains base (zero-extra-dependency)
 * preview plugins. Consumers that need PDF / DOCX / PPTX / XLSX / RTF / ZIP /
 * EPUB rendering must either:
 *
 *   a) Pass a custom `registry` to `<PluginPreviewRenderer>`, or
 *   b) Import `createFullPreviewRegistry` from `@lamberl-lee/file-preview/full`.
 */
export function createBasePreviewRegistry(): PreviewPluginRegistry {
  return createPreviewPluginRegistry(basePreviewPlugins);
}