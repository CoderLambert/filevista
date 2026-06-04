"use client";

import type { FileInfo } from "../utils";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { VideoPreview } from "../VideoPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function VideoPreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading video...</div>;
  }

  if (error || !objectUrl) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to load video"
        description={error?.message ?? "Unable to create video preview."}
      />
    );
  }

  return <VideoPreview url={objectUrl} fileName={file.name} />;
}
