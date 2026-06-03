import type { FileInfo } from "../utils";
import type { PreviewPlugin } from "./plugin";

export class PreviewPluginRegistry {
  private plugins: PreviewPlugin[] = [];

  register(plugin: PreviewPlugin): void {
    const existingIndex = this.plugins.findIndex((item) => item.id === plugin.id);

    if (existingIndex >= 0) {
      this.plugins[existingIndex] = plugin;
      return;
    }

    this.plugins.push(plugin);
  }

  resolve(file: FileInfo): PreviewPlugin | null {
    return this.list().find((plugin) => plugin.match(file)) ?? null;
  }

  list(): PreviewPlugin[] {
    return [...this.plugins].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }
}

export function createPreviewPluginRegistry(
  plugins: PreviewPlugin[]
): PreviewPluginRegistry {
  const registry = new PreviewPluginRegistry();

  for (const plugin of plugins) {
    registry.register(plugin);
  }

  return registry;
}