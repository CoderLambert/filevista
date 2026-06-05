"use client";

import { lazy, Suspense, useMemo, useRef, useState, useCallback } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { FileInfo } from "./utils";
import type { PreviewPlugin } from "./core/plugin";
import type { PreviewPluginRegistry } from "./core/registry";
import { createBuiltinPreviewRegistry } from "./plugins/builtin-plugins";
import { UnsupportedPluginPreview } from "./preview-adapters/UnsupportedPluginPreview";
import { getPreviewSupportMeta } from "./support-status";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";
import { PreviewLoading } from "./PreviewLoading";

/**
 * Error thrown when a preview plugin chunk fails to load.
 */
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
  const componentCache = useRef(
    new WeakMap<PreviewPlugin, LazyExoticComponent<ComponentType<{ file: FileInfo }>>>()
  );

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
      componentCache.current.delete(plugin);
    }

    setRetryKey((value) => value + 1);
  }, [plugin]);

  const PreviewComponent = useMemo(() => {
    if (!plugin) return null;

    const cached = componentCache.current.get(plugin);
    if (cached) return cached;

    const component = lazy(() =>
      plugin.load().catch((error) => {
        throw new PreviewPluginLoadError(plugin.id, plugin.name, error);
      }),
    );

    componentCache.current.set(plugin, component);
    return component;
  }, [plugin, retryKey]);

  if (!PreviewComponent || !plugin) {
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
    <div className="flex flex-col h-full min-h-0">
      {showPluginDebug && (
        <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Plugin Renderer</span>
          <span>→</span>
          <span>{plugin.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
            {plugin.id}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <PreviewErrorBoundary
          file={file}
          pluginId={plugin.id}
          pluginName={plugin.name}
          resetKey={`${file.id}:${plugin.id}:${retryKey}`}
          onRetry={handleRetry}
        >
          <Suspense fallback={<PreviewLoading />}>
            <PreviewComponent file={file} />
          </Suspense>
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
