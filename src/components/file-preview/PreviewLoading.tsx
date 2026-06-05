"use client";

interface PreviewLoadingProps {
  label?: string;
}

export function PreviewLoading({
  label = "Loading preview...",
}: PreviewLoadingProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
