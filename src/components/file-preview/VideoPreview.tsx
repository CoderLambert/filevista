"use client";

interface VideoPreviewProps {
  url: string;
  fileName: string;
}

export function VideoPreview({ url, fileName }: VideoPreviewProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] p-6 bg-black/5 dark:bg-black/20 rounded-lg">
      <video
        src={url}
        controls
        className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
        aria-label={fileName}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
