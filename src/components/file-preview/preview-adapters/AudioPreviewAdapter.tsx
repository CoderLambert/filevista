"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { AudioPreview } from "../AudioPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function AudioPreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading audio...</div>;
  }

  if (error || !objectUrl) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to load audio"
        description={error?.message ?? "Unable to create audio preview."}
      />
    );
  }

  return <AudioPreview url={objectUrl} fileName={file.name} />;
}
