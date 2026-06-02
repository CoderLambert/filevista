import { registerPreviewPlugin } from "../core/registry";
import { imagePlugin } from "./image-plugin";
import { pdfPlugin } from "./pdf-plugin";
import { sourceCodePlugin } from "./source-code-plugin";
import { textPlugin } from "./text-plugin";

export const builtinPreviewPlugins = [
  pdfPlugin,
  sourceCodePlugin,
  textPlugin,
  imagePlugin,
];

let registered = false;

export function registerBuiltinPreviewPlugins(): void {
  if (registered) return;

  builtinPreviewPlugins.forEach(registerPreviewPlugin);
  registered = true;
}
