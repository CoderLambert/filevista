import { createPreviewPluginRegistry, type PreviewPluginRegistry } from "../core/registry";
import type { PreviewPlugin } from "../core/plugin";
import { imagePlugin } from "./image-plugin";
import { pdfPlugin } from "./pdf-plugin";
import { sourceCodePlugin } from "./source-code-plugin";
import { textPlugin } from "./text-plugin";
import { audioPlugin } from "./audio-plugin";
import { videoPlugin } from "./video-plugin";
import { svgPlugin } from "./svg-plugin";
import { csvPlugin } from "./csv-plugin";
import { markdownPlugin } from "./markdown-plugin";
import { htmlPlugin } from "./html-plugin";

export const builtinPreviewPlugins: PreviewPlugin[] = [
  pdfPlugin,
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

export function createBuiltinPreviewRegistry(): PreviewPluginRegistry {
  return createPreviewPluginRegistry(builtinPreviewPlugins);
}