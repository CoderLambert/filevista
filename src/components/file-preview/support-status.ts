import type { FileType } from "./utils";

export type PreviewSupportStatus =
  | "plugin-supported"
  | "legacy-only"
  | "degraded"
  | "unsupported";

export type RendererSupportState = "supported" | "degraded" | "unsupported";

export interface PreviewSupportMeta {
  fileType: FileType;
  status: PreviewSupportStatus;
  legacyRenderer: RendererSupportState;
  pluginRenderer: RendererSupportState;
  pluginId: string | null;
  note?: string;
}

export const PREVIEW_SUPPORT_MATRIX: Record<FileType, PreviewSupportMeta> = {
  pdf: {
    fileType: "pdf",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.pdf",
  },

  code: {
    fileType: "code",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.source-code",
  },

  json: {
    fileType: "json",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.source-code",
    note: "JSON currently reuses the source-code plugin.",
  },

  text: {
    fileType: "text",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.text",
  },

  image: {
    fileType: "image",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.image",
  },

  audio: {
    fileType: "audio",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.audio",
  },

  video: {
    fileType: "video",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.video",
  },

  svg: {
    fileType: "svg",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.svg",
  },

  csv: {
    fileType: "csv",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.csv",
  },

  markdown: {
    fileType: "markdown",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.markdown",
  },

  html: {
    fileType: "html",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.html",
  },

  rtf: {
    fileType: "rtf",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.rtf",
    note: "使用 rtf.js 富文本渲染 + DOMPurify 安全清洗 + iframe sandbox 隔离，复杂/损坏内容自动降级为文本预览。",
  },

  zip: {
    fileType: "zip",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.zip",
  },

  epub: {
    fileType: "epub",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.epub",
  },

  docx: {
    fileType: "docx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.docx",
  },

  pptx: {
    fileType: "pptx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.pptx",
  },

  xlsx: {
    fileType: "xlsx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.xlsx",
  },

  doc: {
    fileType: "doc",
    status: "degraded",
    legacyRenderer: "degraded",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: "该文件为旧版 .doc 二进制格式，当前浏览器端预览仅支持 .docx。建议使用 Word 或 WPS 将文件另存为 .docx 后重试。",
  },

  ppt: {
    fileType: "ppt",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: "该文件为旧版 .ppt 二进制格式，当前浏览器端预览仅支持 .pptx。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 后重试。",
  },

  xls: {
    fileType: "xls",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: "该文件为旧版 .xls 二进制格式，当前浏览器端预览仅支持 .xlsx。建议使用 Excel 或 WPS 将文件另存为 .xlsx 后重试。",
  },

  unknown: {
    fileType: "unknown",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
  },
};

export function getPreviewSupportMeta(fileType: FileType): PreviewSupportMeta {
  return PREVIEW_SUPPORT_MATRIX[fileType];
}

export function isPluginSupportedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "plugin-supported";
}

export function isUnsupportedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "unsupported";
}

export function isDegradedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "degraded";
}
