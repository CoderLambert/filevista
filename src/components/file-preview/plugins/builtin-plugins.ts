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
import { rtfPlugin } from "./rtf-plugin";
import { zipPlugin } from "./zip-plugin";
import { epubPlugin } from "./epub-plugin";
import { docxPlugin } from "./docx-plugin";
import { pptxPlugin } from "./pptx-plugin";

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
  rtfPlugin,
  zipPlugin,
  epubPlugin,
  docxPlugin,
  pptxPlugin,
];

export function createBuiltinPreviewRegistry(): PreviewPluginRegistry {
  return createPreviewPluginRegistry(builtinPreviewPlugins);
}