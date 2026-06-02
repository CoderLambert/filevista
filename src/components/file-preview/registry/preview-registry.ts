import type { FileInfo } from "../utils";
import type {
  PreviewPlugin,
  PreviewPluginContext,
  PreviewPluginRegistry,
} from "./types";

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");

  if (index < 0 || index === normalized.length - 1) {
    return "";
  }

  return normalized.slice(index + 1);
}

function createContext(file: FileInfo): PreviewPluginContext {
  return {
    file,
    fileType: file.fileType,
    fileName: file.name,
    mimeType: "type" in file ? file.type : undefined,
    extension: getFileExtension(file.name),
  };
}

export class DefaultPreviewPluginRegistry implements PreviewPluginRegistry {
  private readonly plugins = new Map<string, PreviewPlugin>();

  register(plugin: PreviewPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Preview plugin "${plugin.id}" has already been registered.`);
    }

    this.plugins.set(plugin.id, plugin);
  }

  registerMany(plugins: PreviewPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  resolve(file: FileInfo): PreviewPlugin | null {
    const context = createContext(file);

    return (
      this.getPlugins()
        .filter((plugin) => plugin.fileTypes.includes(file.fileType))
        .filter((plugin) => plugin.canPreview?.(context) ?? true)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null
    );
  }

  getPlugins(): PreviewPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export function createPreviewPluginRegistry(
  plugins: PreviewPlugin[] = []
): DefaultPreviewPluginRegistry {
  const registry = new DefaultPreviewPluginRegistry();
  registry.registerMany(plugins);
  return registry;
}
