import type { FileType } from "../utils";

interface UnsupportedPluginPreviewProps {
  fileType: FileType;
}

export function UnsupportedPluginPreview({ fileType }: UnsupportedPluginPreviewProps) {
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
