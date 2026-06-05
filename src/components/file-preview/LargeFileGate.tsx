"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { getPreviewSizePolicy } from "./performance-limits";
import { downloadSource } from "./core/download";

interface LargeFileGateProps {
  file: FileInfo;
  confirmed: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function LargeFileGate({
  file,
  confirmed,
  onConfirm,
  children,
}: LargeFileGateProps) {
  const policy = getPreviewSizePolicy({
    size: file.size,
    fileType: file.fileType,
  });

  if (!policy.shouldWarn) {
    return <>{children}</>;
  }

  if (policy.level === "warning") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              Large file: {formatFileSize(file.size)}. Preview may be slower.
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  }

  if (policy.shouldConfirm && !confirmed) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Large file preview</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {policy.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm}>Preview anyway</Button>
          <Button
            variant="outline"
            onClick={() => downloadSource(file.source, file.name, file.type)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  if (policy.shouldBlock) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">File too large to preview</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {policy.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadSource(file.source, file.name, file.type)}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Download original file
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
