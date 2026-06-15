import type { FileInfo } from "./utils";
import { PreviewFallback } from "./PreviewFallback";
import { useLocale } from "./core/i18n";

export interface UnsupportedPluginPreviewProps {
  file: FileInfo;
  title?: string;
  description?: string;
}

export function UnsupportedPluginPreview({
  file,
  title,
  description,
}: UnsupportedPluginPreviewProps) {
  const t = useLocale();

  const UNSUPPORTED_TITLES: Record<string, string> = {
    doc: t.legacyDocTitle,
    ppt: t.legacyPptTitle,
    xls: t.legacyXlsTitle,
  };

  const UNSUPPORTED_DESCRIPTIONS: Record<string, string> = {
    doc: t.legacyDocDesc,
    ppt: t.legacyPptDesc,
    xls: t.legacyXlsDesc,
  };

  return (
    <PreviewFallback
      kind="unsupported"
      file={file}
      title={
        title ?? UNSUPPORTED_TITLES[file.fileType] ?? t.previewNotAvailable
      }
      description={
        description ??
        UNSUPPORTED_DESCRIPTIONS[file.fileType] ??
        t.unsupportedFileType.replace("{fileType}", file.fileType)
      }
      canDownload
    />
  );
}
