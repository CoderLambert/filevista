"use client";

import { lazy, Suspense, useMemo, useRef } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { FileInfo } from "./utils";
import type { PreviewPlugin } from "./core/plugin";
import type { PreviewPluginRegistry } from "./core/registry";
import { createBuiltinPreviewRegistry } from "./plugins/builtin-plugins";
import { UnsupportedPluginPreview } from "./preview-adapters/UnsupportedPluginPreview";

function PreviewLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-xs text-muted-foreground">Loading preview...</p>
      </div>
    </div>
  );
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

  const finalRegistry = useMemo(() => {
    return registry ?? createBuiltinPreviewRegistry();
  }, [registry]);

  const plugin = useMemo(
    () => finalRegistry.resolve(file),
    [finalRegistry, file]
  );

  const PreviewComponent = useMemo(() => {
    if (!plugin) return null;

    const cached = componentCache.current.get(plugin);
    if (cached) return cached;

    const component = lazy(plugin.load);
    componentCache.current.set(plugin, component);
    return component;
  }, [plugin]);

  if (!PreviewComponent || !plugin) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        title="Not Migrated Yet"
        description={`This file type (${file.fileType}) has not been migrated to the plugin renderer yet. You can switch back to Legacy Renderer to preview it.`}
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
        <Suspense fallback={<PreviewLoading />}>
          <PreviewComponent file={file} />
        </Suspense>
      </div>
    </div>
  );
}