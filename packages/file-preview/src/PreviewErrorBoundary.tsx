import React from "react";
import type { FileInfo } from "./utils";
import { PreviewFallback, type PreviewFallbackKind } from "./PreviewFallback";
import { normalizePreviewError, isPreviewError, type PreviewError } from "./core/preview-error";

interface PreviewErrorBoundaryProps {
  file: FileInfo;
  pluginId?: string;
  pluginName?: string;
  resetKey: string;
  onRetry: () => void;
  onError?: (error: PreviewError) => void;
  children: React.ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
  previousResetKey: string;
}

export class PreviewErrorBoundary extends React.Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = {
    error: null,
    previousResetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: PreviewErrorBoundaryProps,
    state: PreviewErrorBoundaryState,
  ) {
    if (props.resetKey !== state.previousResetKey) {
      return {
        error: null,
        previousResetKey: props.resetKey,
      };
    }

    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const previewError = normalizePreviewError(error, {
      code: "RENDER_FAILED",
      message: "Preview rendering failed",
      pluginId: this.props.pluginId,
      pluginName: this.props.pluginName,
      fileName: this.props.file.name,
    });

    console.warn("[preview-error-boundary]", {
      error: previewError,
      info,
      file: this.props.file.name,
      pluginId: this.props.pluginId,
    });

    this.props.onError?.(previewError);
  }

  render() {
    if (this.state.error) {
      const kind: PreviewFallbackKind =
        this.state.error.name === "PreviewPluginLoadError" ||
        (isPreviewError(this.state.error) &&
          this.state.error.code === "MISSING_PEER_DEPENDENCY")
          ? "plugin-load-failed"
          : "render-failed";

      return (
        <PreviewFallback
          kind={kind}
          file={this.props.file}
          error={this.state.error}
          pluginId={this.props.pluginId}
          pluginName={this.props.pluginName}
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}
