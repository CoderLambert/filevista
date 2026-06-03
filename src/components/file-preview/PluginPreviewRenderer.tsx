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
}

export function PluginPreviewRenderer({
  file,
  registry,
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

  if (!PreviewComponent) {
    return <UnsupportedPluginPreview fileType={file.fileType} />;
  }

  return (
    <Suspense fallback={<PreviewLoading />}>
      <PreviewComponent file={file} />
    </Suspense>
  );
}