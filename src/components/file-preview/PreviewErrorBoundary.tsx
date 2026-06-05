"use client";

import React from "react";
import type { FileInfo } from "./utils";
import { PreviewFallback } from "./PreviewFallback";

interface PreviewErrorBoundaryProps {
  file: FileInfo;
  pluginId?: string;
  pluginName?: string;
  resetKey: string;
  onRetry: () => void;
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
    if (process.env.NODE_ENV === "development") {
      console.warn("[preview-error-boundary]", {
        error,
        info,
        file: this.props.file.name,
        pluginId: this.props.pluginId,
      });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <PreviewFallback
          kind="render-failed"
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
