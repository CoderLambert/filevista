import { useEffect, useMemo, useState, useCallback } from "react";
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

// Load state for a plugin module. We use an explicit state machine instead of
// React 19's `use(promise)` so the library stays compatible with React 18
// (where `use` is unavailable). The three states map to:
//   loading → show <PreviewLoading />
//   error  → throw so the surrounding <PreviewErrorBoundary> catches it
//            (this preserves the existing Retry path: invalidatePluginPromise
//            + resetKey bump forces a remount with a fresh promise)
//   ready  → render the resolved component
type PluginContentState =
  | { status: "loading" }
  | { status: "ready"; Component: ComponentType<{ file: FileInfo }> }
  | { status: "error"; error: Error };

function PluginContent({ plugin, file }: PluginContentProps) {
  const [state, setState] = useState<PluginContentState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getPluginPromise(plugin)
      .then((mod) => {
        if (!cancelled) {
          setState({ status: "ready", Component: mod.default });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error
                : new Error(String(error)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [plugin]);

  if (state.status === "loading") return <PreviewLoading />;
  if (state.status === "error") throw state.error;
  return <state.Component file={file} />;
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
          <PluginContent plugin={plugin} file={file} />
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
