"use client";

interface AudioPreviewProps {
  url: string;
  fileName: string;
}

export function AudioPreview({ url, fileName }: AudioPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6 p-6">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-medium">{fileName}</p>
        <p className="text-sm text-muted-foreground mt-1">Audio file</p>
      </div>
      <audio
        src={url}
        controls
        className="w-full max-w-md"
        aria-label={fileName}
      >
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}
