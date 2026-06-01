"use client";

import { FileInfo, FileType } from "./utils";
import { PdfPreview } from "./PdfPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { CodePreview } from "./CodePreview";
import { DocxPreview } from "./DocxPreview";
import { DocPreview } from "./DocPreview";
import { PptxPreview } from "./PptxPreview";
import { XlsxPreview } from "./XlsxPreview";
import { HtmlPreview } from "./HtmlPreview";
import { ZipPreview } from "./ZipPreview";
import { SvgPreview } from "./SvgPreview";
import { RtfPreview } from "./RtfPreview";
import { EpubPreview } from "./EpubPreview";
import { ImagePreview } from "./ImagePreview";
import { TextPreview } from "./TextPreview";
import { CsvPreview } from "./CsvPreview";
import { VideoPreview } from "./VideoPreview";
import { AudioPreview } from "./AudioPreview";

interface FilePreviewRendererProps {
  file: FileInfo;
}

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

export function FilePreviewRenderer({ file }: FilePreviewRendererProps) {
  switch (file.fileType) {
    case "pdf":
      return file.content ? (
        <PdfPreview base64Content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="pdf" />
      );

    case "markdown":
      return file.content ? (
        <MarkdownPreview content={file.content} />
      ) : (
        <UnsupportedPreview fileType="markdown" />
      );

    case "json":
      return file.content ? (
        <CodePreview content={file.content} fileName={file.name} isJson />
      ) : (
        <UnsupportedPreview fileType="json" />
      );

    case "code":
      return file.content ? (
        <CodePreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="code" />
      );

    case "docx":
      return file.content ? (
        <DocxPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="docx" />
      );

    case "doc":
      return file.content ? (
        <DocPreview base64Content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="doc" />
      );

    case "pptx":
      return file.content ? (
        <PptxPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="pptx" />
      );

    case "xlsx":
      return file.content ? (
        <XlsxPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="xlsx" />
      );

    case "html":
      return file.content ? (
        <HtmlPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="html" />
      );

    case "zip":
      return file.content ? (
        <ZipPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="zip" />
      );

    case "svg":
      return file.content ? (
        <SvgPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="svg" />
      );

    case "rtf":
      return file.content ? (
        <RtfPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="rtf" />
      );

    case "epub":
      return file.content ? (
        <EpubPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="epub" />
      );

    case "image":
      return file.url ? (
        <ImagePreview url={file.url} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="image" />
      );

    case "text":
      return file.content ? (
        <TextPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="text" />
      );

    case "csv":
      return file.content ? (
        <CsvPreview content={file.content} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="csv" />
      );

    case "video":
      return file.url ? (
        <VideoPreview url={file.url} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="video" />
      );

    case "audio":
      return file.url ? (
        <AudioPreview url={file.url} fileName={file.name} />
      ) : (
        <UnsupportedPreview fileType="audio" />
      );

    default:
      return <UnsupportedPreview fileType={file.fileType} />;
  }
}
