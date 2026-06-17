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
import { LargeFileGate } from "./LargeFileGate";
import { PreviewError, isPreviewError } from "./core/preview-error";
import type { PreviewErrorCode } from "./core/preview-error";
import "./styles/PluginDebugBar.css";

class PreviewPluginLoadError extends PreviewError {
  constructor(
    public pluginId: string,
    public pluginName: string,
    cause: unknown,
  ) {
    const code: PreviewErrorCode = isPreviewError(cause)
      ? cause.code
      : "RENDER_FAILED";
    super(code, `Failed to load preview plugin: ${pluginName}`, {
      cause,
      pluginId,
      pluginName,
    });
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
  /**
   * Called with a stable PreviewError whenever the renderer reaches a
   * consumer-actionable failure path (unsupported file type, plugin load
   * failure, render crash). Prefer switching on `error.code` over parsing
   * `error.message`.
   */
  onError?: (error: PreviewError) => void;
  /**
   * Large-file protection policy.
   *
   * - `"default"` (default): the renderer wraps its output in an internal
   *   `LargeFileGate` that warns at 20 MB, requires confirmation at 50 MB,
   *   and blocks preview (download only) at 100 MB. This is the safe
   *   default — real users upload unpredictable files.
   * - `"off"`: no gate. Use only when the caller enforces its own size
   *   policy or is previewing trusted, size-bounded content.
   */
  largeFilePolicy?: "default" | "off";
}

export function PluginPreviewRenderer({
  file,
  registry,
  showPluginDebug = false,
  onError,
  largeFilePolicy = "default",
}: PluginPreviewRendererProps) {
  const [retryKey, setRetryKey] = useState(0);

  const finalRegistry = useMemo(() => {
    return registry ?? createBuiltinPreviewRegistry();
  }, [registry]);

  const plugin = useMemo(
    () => finalRegistry.resolve(file),
    [finalRegistry, file]
  );

  useEffect(() => {
    if (plugin) return;
    onError?.(
      new PreviewError(
        "UNSUPPORTED_FILE_TYPE",
        `Unsupported file type: ${file.fileType}`,
        { fileName: file.name, details: { fileType: file.fileType } },
      ),
    );
  }, [file.fileType, file.name, onError, plugin]);

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

  const content = (
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
          onError={onError}
        >
          <PluginContent plugin={plugin} file={file} />
        </PreviewErrorBoundary>
      </div>
    </div>
  );

  // Default: protect against accidentally previewing huge files. The gate
  // is a no-op for files under the 20 MB warning threshold, so normal-size
  // previews render exactly as before.
  if (largeFilePolicy === "off") return content;
  return <LargeFileGate file={file}>{content}</LargeFileGate>;
}
