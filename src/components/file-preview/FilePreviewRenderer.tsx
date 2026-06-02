"use client";

import { lazy, Suspense, useMemo } from "react";
import { FileInfo, FileType } from "./utils";
import { UnsupportedLegacyOfficePreview } from "./UnsupportedLegacyOfficePreview";

// Lazy load all preview components — each may pull in heavy dependencies
// (e.g. PDF renderer, Office parsers, media players, Shiki, etc.)
const PdfPreview = lazy(() =>
  import("./PdfPreview").then((m) => ({ default: m.PdfPreview }))
);
const MarkdownPreview = lazy(() =>
  import("./MarkdownPreview").then((m) => ({ default: m.MarkdownPreview }))
);
const CodePreview = lazy(() =>
  import("./CodePreview").then((m) => ({ default: m.CodePreview }))
);
const DocxPreview = lazy(() =>
  import("./DocxPreview").then((m) => ({ default: m.DocxPreview }))
);
const DocPreview = lazy(() =>
  import("./DocPreview").then((m) => ({ default: m.DocPreview }))
);
const PptxPreview = lazy(() =>
  import("./PptxPreview").then((m) => ({ default: m.PptxPreview }))
);
const XlsxPreview = lazy(() =>
  import("./XlsxPreview").then((m) => ({ default: m.XlsxPreview }))
);
const HtmlPreview = lazy(() =>
  import("./HtmlPreview").then((m) => ({ default: m.HtmlPreview }))
);
const ZipPreview = lazy(() =>
  import("./ZipPreview").then((m) => ({ default: m.ZipPreview }))
);
const SvgPreview = lazy(() =>
  import("./SvgPreview").then((m) => ({ default: m.SvgPreview }))
);
const RtfPreview = lazy(() =>
  import("./RtfPreview").then((m) => ({ default: m.RtfPreview }))
);
const EpubPreview = lazy(() =>
  import("./EpubPreview").then((m) => ({ default: m.EpubPreview }))
);
const ImagePreview = lazy(() =>
  import("./ImagePreview").then((m) => ({ default: m.ImagePreview }))
);
const TextPreview = lazy(() =>
  import("./TextPreview").then((m) => ({ default: m.TextPreview }))
);
const CsvPreview = lazy(() =>
  import("./CsvPreview").then((m) => ({ default: m.CsvPreview }))
);
const VideoPreview = lazy(() =>
  import("./VideoPreview").then((m) => ({ default: m.VideoPreview }))
);
const AudioPreview = lazy(() =>
  import("./AudioPreview").then((m) => ({ default: m.AudioPreview }))
);

// ── Single file renderer (extracted for reuse) ──

function UnsupportedPreview({ fileType }: { fileType: FileType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
        <path d="M14 2v6h6"/>
        <path d="M12 18v-6"/>
        <path d="m9 15 3-3 3 3"/>
      </svg>
      <p className="text-lg font-medium">Preview Not Available</p>
      <p className="text-sm">
        This file type ({fileType}) cannot be previewed in the browser.
      </p>
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-xs text-muted-foreground">Loading preview...</p>
      </div>
    </div>
  );
}

/**
 * Render a single file's preview content (without caching logic).
 * Used by both direct render and TabCache.
 */
export function FilePreviewContent({ file }: { file: FileInfo }) {
  switch (file.fileType) {
    case "pdf":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <PdfPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="pdf" />
      );

    case "markdown":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <MarkdownPreview content={file.content} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="markdown" />
      );

    case "json":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <CodePreview content={file.content} fileName={file.name} isJson />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="json" />
      );

    case "code":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <CodePreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="code" />
      );

    case "docx":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <DocxPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="docx" />
      );

    case "doc":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <DocPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="doc" />
      );

    case "pptx":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <PptxPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="pptx" />
      );

    case "ppt":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <UnsupportedLegacyOfficePreview
            type="ppt"
            fileName={file.name}
            content={file.content}
            title="旧版 PowerPoint 格式暂不支持"
            description="该文件为旧版 .ppt 二进制格式，当前浏览器端预览仅支持 .pptx。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 后重试。"
          />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="ppt" />
      );

    case "xlsx":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <XlsxPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="xlsx" />
      );

    case "xls":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <UnsupportedLegacyOfficePreview
            type="xls"
            fileName={file.name}
            content={file.content}
            title="旧版 Excel 格式暂不支持"
            description="该文件为旧版 .xls 二进制格式，当前浏览器端预览仅支持 .xlsx。建议使用 Excel 或 WPS 将文件另存为 .xlsx 后重试。"
          />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="xls" />
      );

    case "html":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <HtmlPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="html" />
      );

    case "zip":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <ZipPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="zip" />
      );

    case "svg":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <SvgPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="svg" />
      );

    case "rtf":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <RtfPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="rtf" />
      );

    case "epub":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <EpubPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="epub" />
      );

    case "image":
      return file.url ? (
        <Suspense fallback={<PreviewLoading />}>
          <ImagePreview url={file.url} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="image" />
      );

    case "text":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <TextPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="text" />
      );

    case "csv":
      return file.content ? (
        <Suspense fallback={<PreviewLoading />}>
          <CsvPreview content={file.content} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="csv" />
      );

    case "video":
      return file.url ? (
        <Suspense fallback={<PreviewLoading />}>
          <VideoPreview url={file.url} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="video" />
      );

    case "audio":
      return file.url ? (
        <Suspense fallback={<PreviewLoading />}>
          <AudioPreview url={file.url} fileName={file.name} />
        </Suspense>
      ) : (
        <UnsupportedPreview fileType="audio" />
      );

    default:
      return <UnsupportedPreview fileType={file.fileType} />;
  }
}

// ── TabCache: Keep-alive renderer ──
// Inspired by Magic's TabCache pattern: instead of unmounting preview components
// on file switch, we use CSS display to hide/show them. This preserves:
// - PDF parsed state & scroll position
// - DOCX/XLSX/PPTX rendered output
// - Shiki highlighter cache
// - EPUB reading position
// - Any other component-internal state

interface TabCacheRendererProps {
  files: FileInfo[];
  activeFileId: string | null;
}

export function TabCacheRenderer({ files, activeFileId }: TabCacheRendererProps) {
  // Memoize file lookup for stable references
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  return (
    <div className="relative h-full">
      {files.map((file) => {
        const isActive = file.id === activeFileId;

        return (
          <div
            key={file.id}
            className="absolute inset-0"
            style={{
              display: isActive ? "flex" : "none",
              flexDirection: "column",
            }}
            // Hide from screen readers when inactive
            aria-hidden={!isActive}
            tabIndex={isActive ? 0 : -1}
          >
            <FilePreviewContent file={file} />
          </div>
        );
      })}

      {/* Show empty state when no file is active */}
      {files.length === 0 && (
        <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground">
          <p className="text-sm">No file selected</p>
        </div>
      )}
    </div>
  );
}

// Keep backward compatibility: simple single-file renderer
export function FilePreviewRenderer({ file }: { file: FileInfo }) {
  return <FilePreviewContent file={file} />;
}
