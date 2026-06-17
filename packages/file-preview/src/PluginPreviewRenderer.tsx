import { Suspense, use, useMemo, useState, useCallback } from "react";
import type { ComponentType } from "react";
import type { FileInfo } from "./utils";
import type { PreviewPlugin } from "./core/plugin";
import type { PreviewPluginRegistry } from "./core/registry";
import { createBuiltinPreviewRegistry } from "./plugins/builtin-plugins";
import { UnsupportedPluginPreview } from "./preview-adapters/UnsupportedPluginPreview";
import { getPreviewSupportMeta } from "./support-status";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";
import { PreviewLoading } from "./PreviewLoading";
import "./styles/PluginDebugBar.css";

class PreviewPluginLoadError extends Error {
  constructor(
    public pluginId: string,
    public pluginName: string,
    public cause: unknown,
  ) {
    super(`Failed to load preview plugin: ${pluginName}`);
    this.name = "PreviewPluginLoadError";
  }
}

type PluginModule = { default: ComponentType<{ file: FileInfo }> };
const promiseCache = new WeakMap<PreviewPlugin, Promise<PluginModule>>();

function getPluginPromise(plugin: PreviewPlugin): Promise<PluginModule> {
  const cached = promiseCache.get(plugin);
  if (cached) return cached;

  const promise = plugin.load().catch((error) => {
    throw new PreviewPluginLoadError(plugin.id, plugin.name, error);
  });
  promiseCache.set(plugin, promise);
  return promise;
}

function invalidatePluginPromise(plugin: PreviewPlugin) {
  promiseCache.delete(plugin);
}

interface PluginContentProps {
  plugin: PreviewPlugin;
  file: FileInfo;
}

function PluginContent({ plugin, file }: PluginContentProps) {
  const mod = use(getPluginPromise(plugin));
  const Component = mod.default;
  return <Component file={file} />;
}

export interface PluginPreviewRendererProps {
  file: FileInfo;
  registry?: PreviewPluginRegistry;
  showPluginDebug?: boolean;
}

export function PluginPreviewRenderer({
  file,
  registry,
  showPluginDebug = false,
}: PluginPreviewRendererProps) {
  const [retryKey, setRetryKey] = useState(0);

  const finalRegistry = useMemo(() => {
    return registry ?? createBuiltinPreviewRegistry();
  }, [registry]);

  const plugin = useMemo(
    () => finalRegistry.resolve(file),
    [finalRegistry, file]
  );

  const handleRetry = useCallback(() => {
    if (plugin) {
      invalidatePluginPromise(plugin);
    }
    setRetryKey((value) => value + 1);
  }, [plugin]);

  if (!plugin) {
    const support = getPreviewSupportMeta(file.fileType);

    return (
      <UnsupportedPluginPreview
        file={file}
        title={support.status === "legacy-only" ? "Not Migrated Yet" : undefined}
        description={
          support.status === "legacy-only"
            ? `This file type (${file.fileType}) is currently only available in Legacy Renderer.`
            : support.status === "degraded"
              ? support.note ??
                `This file type (${file.fileType}) only has degraded legacy support and is not available in Plugin Renderer.`
              : support.note ??
                `This file type (${file.fileType}) cannot be previewed by the plugin renderer.`
        }
      />
    );
  }

  return (
    <div className="fv-plugin-renderer">
      {showPluginDebug && (
        <div className="fv-plugin-debug">
          <span className="fv-plugin-debug__label">Plugin Renderer</span>
          <span>→</span>
          <span>{plugin.name}</span>
          <span className="fv-plugin-debug__id">{plugin.id}</span>
        </div>
      )}

      <div className="fv-plugin-renderer__content">
        <PreviewErrorBoundary
          file={file}
          pluginId={plugin.id}
          pluginName={plugin.name}
          resetKey={`${file.id}:${plugin.id}:${retryKey}`}
          onRetry={handleRetry}
        >
          <Suspense fallback={<PreviewLoading />}>
            <PluginContent plugin={plugin} file={file} />
          </Suspense>
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
