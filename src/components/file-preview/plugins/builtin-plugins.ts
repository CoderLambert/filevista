import { createPreviewPluginRegistry, type PreviewPluginRegistry } from "../core/registry";
import type { PreviewPlugin } from "../core/plugin";
import { imagePlugin } from "./image-plugin";
import { pdfPlugin } from "./pdf-plugin";
import { sourceCodePlugin } from "./source-code-plugin";
import { textPlugin } from "./text-plugin";

export const builtinPreviewPlugins: PreviewPlugin[] = [
  pdfPlugin,
  sourceCodePlugin,
  textPlugin,
  imagePlugin,
];

export function createBuiltinPreviewRegistry(): PreviewPluginRegistry {
  return createPreviewPluginRegistry(builtinPreviewPlugins);
}