"use client";

import { useEffect, useState } from "react";

interface PdfPreviewProps {
  url: string;
  fileName: string;
}

export function PdfPreview({ url, fileName }: PdfPreviewProps) {
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      // Cleanup object URL when component unmounts
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
          <path d="M14 2v6h6"/>
          <path d="m10 18-2-2 2-2"/>
          <path d="m14 14 2 2-2 2"/>
        </svg>
        <p className="text-lg font-medium">PDF Preview Unavailable</p>
        <p className="text-sm">Unable to render this PDF file in the browser.</p>
        <a
          href={url}
          download={fileName}
          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          Download PDF
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[600px]">
      <iframe
        src={url}
        className="w-full h-full border-0 rounded-md"
        style={{ minHeight: "600px" }}
        title={fileName}
        onError={() => setError(true)}
      />
    </div>
  );
}
