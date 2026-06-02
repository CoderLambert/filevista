import type { FileInfo } from "../utils";
import type { PreviewPlugin } from "./plugin";

const plugins: PreviewPlugin[] = [];

function sortPlugins(items: PreviewPlugin[]): PreviewPlugin[] {
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function registerPreviewPlugin(plugin: PreviewPlugin): void {
  const existingIndex = plugins.findIndex((item) => item.id === plugin.id);

  if (existingIndex >= 0) {
    plugins[existingIndex] = plugin;
    return;
  }

  plugins.push(plugin);
}

export function matchPreviewPlugin(file: FileInfo): PreviewPlugin | null {
  return sortPlugins(plugins).find((plugin) => plugin.match(file)) ?? null;
}

export function getPreviewPlugins(): PreviewPlugin[] {
  return sortPlugins(plugins);
}
