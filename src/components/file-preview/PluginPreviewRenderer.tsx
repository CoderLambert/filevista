"use client";

import { lazy, Suspense, useMemo } from "react";
import { matchPreviewPlugin } from "./core/registry";
import { registerBuiltinPreviewPlugins } from "./plugins/builtin-plugins";
import type { FileInfo, FileType } from "./utils";

registerBuiltinPreviewPlugins();

function UnsupportedPreview({ fileType }: { fileType: FileType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M12 18v-6" />
        <path d="m9 15 3-3 3 3" />
      </svg>
      <p className="text-lg font-medium">Preview Not Available</p>
      <p className="text-sm">
        This file type ({fileType}) cannot be previewed by the plugin renderer.
      </p>
    </div>
  );
}

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

export function PluginPreviewRenderer({ file }: { file: FileInfo }) {
  const plugin = useMemo(() => matchPreviewPlugin(file), [file]);
  const PreviewComponent = useMemo(
    () => (plugin ? lazy(plugin.load) : null),
    [plugin]
  );

  if (!PreviewComponent) {
    return <UnsupportedPreview fileType={file.fileType} />;
  }

  return (
    <Suspense fallback={<PreviewLoading />}>
      <PreviewComponent file={file} />
    </Suspense>
  );
}
