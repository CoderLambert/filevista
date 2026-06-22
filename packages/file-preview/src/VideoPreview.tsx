"use client";

import "./styles/VideoPreview.css";

interface VideoPreviewProps {
  url: string;
  fileName: string;
}

export function VideoPreview({ url, fileName }: VideoPreviewProps) {
  return (
    <div className="fv-video">
      <video
        src={url}
        controls
        className="fv-video__player"
        aria-label={fileName}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
