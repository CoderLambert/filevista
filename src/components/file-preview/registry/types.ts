import type { ReactNode } from "react";
import type { FileInfo, FileType } from "../utils";

export interface PreviewPluginContext {
  file: FileInfo;
  fileType: FileType;
  fileName: string;
  mimeType?: string;
  extension: string;
}

export interface PreviewPlugin {
  /**
   * Stable plugin id, for debugging, sorting and future plugin overrides.
   */
  id: string;

  /**
   * Human-readable plugin name.
   */
  name: string;

  /**
   * The file types this plugin supports.
   */
  fileTypes: FileType[];

  /**
   * Higher priority wins when multiple plugins match the same file.
   */
  priority?: number;

  /**
   * Optional fine-grained matcher.
   * Use this later for cases like:
   * - same FileType but different MIME
   * - feature detection
   * - fallback plugin
   */
  canPreview?: (context: PreviewPluginContext) => boolean;

  /**
   * Render the preview UI.
   * Existing preview components stay lazy-loaded inside plugin definitions.
   */
  render: (context: PreviewPluginContext) => ReactNode;
}

export interface PreviewPluginRegistry {
  register(plugin: PreviewPlugin): void;
  registerMany(plugins: PreviewPlugin[]): void;
  resolve(file: FileInfo): PreviewPlugin | null;
  getPlugins(): PreviewPlugin[];
}
