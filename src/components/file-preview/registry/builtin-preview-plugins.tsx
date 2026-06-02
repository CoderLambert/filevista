import { lazy } from "react";
import type { PreviewPlugin } from "./types";

const PdfPreview = lazy(() =>
  import("../PdfPreview").then((m) => ({ default: m.PdfPreview }))
);

const MarkdownPreview = lazy(() =>
  import("../MarkdownPreview").then((m) => ({ default: m.MarkdownPreview }))
);

const CodePreview = lazy(() =>
  import("../CodePreview").then((m) => ({ default: m.CodePreview }))
);

const DocxPreview = lazy(() =>
  import("../DocxPreview").then((m) => ({ default: m.DocxPreview }))
);

const DocPreview = lazy(() =>
  import("../DocPreview").then((m) => ({ default: m.DocPreview }))
);

const PptxPreview = lazy(() =>
  import("../PptxPreview").then((m) => ({ default: m.PptxPreview }))
);

const XlsxPreview = lazy(() =>
  import("../XlsxPreview").then((m) => ({ default: m.XlsxPreview }))
);

const HtmlPreview = lazy(() =>
  import("../HtmlPreview").then((m) => ({ default: m.HtmlPreview }))
);

const ZipPreview = lazy(() =>
  import("../ZipPreview").then((m) => ({ default: m.ZipPreview }))
);

const SvgPreview = lazy(() =>
  import("../SvgPreview").then((m) => ({ default: m.SvgPreview }))
);

const RtfPreview = lazy(() =>
  import("../RtfPreview").then((m) => ({ default: m.RtfPreview }))
);

const EpubPreview = lazy(() =>
  import("../EpubPreview").then((m) => ({ default: m.EpubPreview }))
);

const ImagePreview = lazy(() =>
  import("../ImagePreview").then((m) => ({ default: m.ImagePreview }))
);

const TextPreview = lazy(() =>
  import("../TextPreview").then((m) => ({ default: m.TextPreview }))
);

const CsvPreview = lazy(() =>
  import("../CsvPreview").then((m) => ({ default: m.CsvPreview }))
);

const VideoPreview = lazy(() =>
  import("../VideoPreview").then((m) => ({ default: m.VideoPreview }))
);

const AudioPreview = lazy(() =>
  import("../AudioPreview").then((m) => ({ default: m.AudioPreview }))
);

export const builtinPreviewPlugins: PreviewPlugin[] = [
  {
    id: "builtin.pdf",
    name: "PDF Preview",
    fileTypes: ["pdf"],
    render: ({ file }) => (
      <PdfPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.markdown",
    name: "Markdown Preview",
    fileTypes: ["markdown"],
    render: ({ file }) => (
      <MarkdownPreview content={file.content ?? ""} />
    ),
  },
  {
    id: "builtin.json",
    name: "JSON Preview",
    fileTypes: ["json"],
    render: ({ file }) => (
      <CodePreview content={file.content ?? ""} fileName={file.name} isJson />
    ),
  },
  {
    id: "builtin.code",
    name: "Code Preview",
    fileTypes: ["code"],
    render: ({ file }) => (
      <CodePreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.docx",
    name: "DOCX Preview",
    fileTypes: ["docx"],
    render: ({ file }) => (
      <DocxPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.doc",
    name: "DOC Preview",
    fileTypes: ["doc"],
    render: ({ file }) => (
      <DocPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.pptx",
    name: "PPTX Preview",
    fileTypes: ["pptx"],
    render: ({ file }) => (
      <PptxPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.xlsx",
    name: "XLSX Preview",
    fileTypes: ["xlsx"],
    render: ({ file }) => (
      <XlsxPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.html",
    name: "HTML Preview",
    fileTypes: ["html"],
    render: ({ file }) => (
      <HtmlPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.zip",
    name: "ZIP Preview",
    fileTypes: ["zip"],
    render: ({ file }) => (
      <ZipPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.svg",
    name: "SVG Preview",
    fileTypes: ["svg"],
    render: ({ file }) => (
      <SvgPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.rtf",
    name: "RTF Preview",
    fileTypes: ["rtf"],
    render: ({ file }) => (
      <RtfPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.epub",
    name: "EPUB Preview",
    fileTypes: ["epub"],
    render: ({ file }) => (
      <EpubPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.image",
    name: "Image Preview",
    fileTypes: ["image"],
    render: ({ file }) => (
      <ImagePreview url={file.url ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.text",
    name: "Text Preview",
    fileTypes: ["text"],
    render: ({ file }) => (
      <TextPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.csv",
    name: "CSV Preview",
    fileTypes: ["csv"],
    render: ({ file }) => (
      <CsvPreview content={file.content ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.video",
    name: "Video Preview",
    fileTypes: ["video"],
    render: ({ file }) => (
      <VideoPreview url={file.url ?? ""} fileName={file.name} />
    ),
  },
  {
    id: "builtin.audio",
    name: "Audio Preview",
    fileTypes: ["audio"],
    render: ({ file }) => (
      <AudioPreview url={file.url ?? ""} fileName={file.name} />
    ),
  },
];
