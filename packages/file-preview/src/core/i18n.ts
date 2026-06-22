/**
 * FileVista i18n — locale messages for all UI strings.
 *
 * Library consumers can import and override any locale, or provide
 * a fully custom translation via `<FileVistaProvider locale={...}>`.
 *
 * Usage in components:
 *   import { useLocale } from "./core/i18n";
 *   const t = useLocale();
 *   <button>{t.preview}</button>
 */

// ─── Type definition ───

export interface LocaleMessages {
  // View mode bar
  preview: string;
  source: string;
  split: string;

  // Common actions
  download: string;
  copy: string;
  search: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  fullscreen: string;
  previous: string;
  next: string;

  // Page / slide units
  page: string;
  pages: string;
  slideView: string;
  gridView: string;
  previousPage: string;
  nextPage: string;

  // Loading states
  loadingPreview: string;
  loadingRtf: string;
  loadingSpreadsheet: string;
  loadingEbook: string;
  loadingPresentation: string;

  // Error states
  previewFailed: string;
  parseFailed: string;
  formatNotSupported: string;

  // Legacy office formats
  legacyDocTitle: string;
  legacyPptTitle: string;
  legacyXlsTitle: string;
  legacyDocDesc: string;
  legacyPptDesc: string;
  legacyXlsDesc: string;
  legacyXlsFallbackDesc: string;
  legacyXlsError: string;
  legacyXlsBanner: string;
  unsupportedFileType: string;

  // Large file
  largeFileHint: string;
  largeFile: string;
  largeFileRows: string;
  largeFileCols: string;
  largeFileImages: string;
  largeFileFastModeBanner: string;
  largeFileFidelityBanner: string;
  largeFileFidelityConfirm: string;
  truncatedRows: string;
  modeSelectionTitle: string;
  modeSelectionDesc: string;
  modeSelectionFastMode: string;
  modeSelectionFastModeDesc: string;
  modeSelectionFidelityMode: string;
  modeSelectionFidelityModeDesc: string;
  modeSelectionContinue: string;

  // Pagination
  paginationInfo: string;
  paginationFirst: string;
  paginationPrevious: string;
  paginationPage: string;
  paginationNext: string;
  paginationLast: string;
  paginationPageSize: string;

  // Spreadsheet
  sheetNotFound: string;
  fastMode: string;
  fidelityMode: string;
  fastModeTitle: string;
  fidelityModeTitle: string;
  noData: string;
  noSearchResults: string;
  comment: string;
  unsupportedImageFormat: string;
  unknown: string;
  downloadOriginal: string;
  enhancedRenderer: string;
  tableRenderer: string;
  enhancedRendererTitle: string;
  tableRendererTitle: string;
  enhancedRendererUnavailable: string;

  // Plain text
  lines: string;
  wordWrapOn: string;
  wordWrapOff: string;
  copyContent: string;

  // Markdown
  oversizedCodeBlock: string;

  // RTF
  rtfFallback: string;
  rtfNoText: string;
  showErrorDetails: string;

  // EPUB
  noChaptersFound: string;
  ebookLoadFailed: string;
  unknownError: string;
  tableOfContents: string;
  foundInChapters: string;
  noResultsFound: string;
  searchPlaceholder: string;

  // Shared fallback
  previewNotAvailable: string;
  failedToLoadPreview: string;
  failedToReadFile: string;
  loadingCancelled: string;
  copyCode: string;

  // PPTX fallback
  pptxFallbackTitle: string;
  pptxFallbackSemanticDesc: string;
  pptxFallbackSummaryDesc: string;
  pptxFallbackImages: string;
  pptxFallbackTextBlocks: string;
  fallbackErrorDetails: string;
}

// ─── zh-CN (default) ───

export const zhCN: LocaleMessages = {
  // View mode bar
  preview: "预览",
  source: "源码",
  split: "分栏",

  // Common actions
  download: "下载",
  copy: "复制",
  search: "搜索...",
  zoomIn: "放大",
  zoomOut: "缩小",
  reset: "重置",
  fullscreen: "全屏",
  previous: "上一个",
  next: "下一个",

  // Page / slide units
  page: "页",
  pages: "页",
  slideView: "幻灯片视图",
  gridView: "缩略图视图",
  previousPage: "上一页 (←)",
  nextPage: "下一页 (→)",

  // Loading states
  loadingPreview: "加载预览中...",
  loadingRtf: "正在解析 RTF...",
  loadingSpreadsheet: "正在解析表格...",
  loadingEbook: "Loading e-book...",
  loadingPresentation: "正在解析演示文稿...",

  // Error states
  previewFailed: "预览失败",
  parseFailed: "解析失败",
  formatNotSupported: "格式不支持",

  // Legacy office formats
  legacyDocTitle: "旧版 Word 格式暂不支持",
  legacyPptTitle: "旧版 PowerPoint 格式暂不支持",
  legacyXlsTitle: "旧版 Excel 格式暂不支持",
  legacyDocDesc: "该文件为旧版 .doc 二进制格式，当前浏览器端预览仅支持 .docx。建议使用 Word 或 WPS 将文件另存为 .docx 后重试。",
  legacyPptDesc: "该文件为旧版 .ppt 二进制格式，当前仅支持 Open XML 格式（.pptx）。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 格式后重试。",
  legacyXlsDesc: "该文件为旧版 .xls 二进制格式，当前仅支持 Open XML 格式（.xlsx/.xlsm）。建议使用 Excel 或 WPS 将文件另存为 .xlsx 格式后重试。",
  legacyXlsFallbackDesc: "当前文件为旧版 .xls 格式，部分内容可能无法完整显示。建议另存为 .xlsx 格式以获得最佳预览效果。",
  legacyXlsError: "该文件为旧版 Excel 二进制格式（.xls），当前仅支持 Open XML 格式（.xlsx/.xlsm）。建议使用 Excel 或 WPS 将文件另存为 .xlsx 格式后重试。",
  legacyXlsBanner: "旧版 Excel 格式暂不支持",
  unsupportedFileType: "该文件类型 ({fileType}) 暂不支持浏览器端预览。",

  // Large file
  largeFileHint: "当前文件较大，浏览器端解析可能需要更长时间，期间页面可能短暂卡顿。",
  largeFile: "大文件",
  largeFileRows: "行",
  largeFileCols: "列",
  largeFileImages: "张图片",
  largeFileFastModeBanner: "当前 Excel 文件较大（{fileSize}），已默认使用快速模式：仅渲染前 {rowLimit} 行，并跳过图片解析。",
  largeFileFidelityBanner: "当前正在使用高保真模式预览大文件，可能导致浏览器卡顿。",
  largeFileFidelityConfirm: "当前 Excel 文件大小为 {fileSize}，高保真模式可能导致浏览器卡顿甚至无响应。是否继续？",
  truncatedRows: "数据量较大，仅显示前 {shown} 行（共 {total} 行）",
  modeSelectionTitle: "选择预览模式",
  modeSelectionDesc: "当前文件大小为 {fileSize}，请选择预览模式：",
  modeSelectionFastMode: "快速模式",
  modeSelectionFastModeDesc: "仅渲染前 1000 行，跳过图片和复杂样式，加载更快",
  modeSelectionFidelityMode: "高保真模式",
  modeSelectionFidelityModeDesc: "保留样式、图片、批注，但大文件可能导致卡顿",
  modeSelectionContinue: "继续",

  // Pagination
  paginationInfo: "显示 {start}-{end}，共 {total} 行",
  paginationFirst: "第一页",
  paginationPrevious: "上一页",
  paginationPage: "第 {current} / {total} 页",
  paginationNext: "下一页",
  paginationLast: "最后一页",
  paginationPageSize: "每页显示：",

  // Spreadsheet
  sheetNotFound: "未找到工作表",
  fastMode: "快速",
  fidelityMode: "高保真",
  fastModeTitle: "快速模式：限制行数，跳过图片和复杂样式",
  fidelityModeTitle: "高保真模式：保留样式、图片、批注",
  noData: "无数据",
  noSearchResults: "未找到匹配数据",
  comment: "批注",
  unsupportedImageFormat: "不支持的图片格式",
  unknown: "未知",
  downloadOriginal: "下载原文件",
  enhancedRenderer: "增强",
  tableRenderer: "表格",
  enhancedRendererTitle: "增强模式：使用类 Excel 电子表格渲染器",
  tableRendererTitle: "表格模式：使用稳定的 HTML 表格预览",
  enhancedRendererUnavailable: "增强电子表格渲染器不可用，已自动降级为表格预览。",

  // Plain text
  lines: "行",
  wordWrapOn: "开启自动换行",
  wordWrapOff: "关闭自动换行",
  copyContent: "复制内容",

  // Markdown
  oversizedCodeBlock: "大代码块",

  // RTF
  rtfFallback: "富文本渲染不可用，已降级为纯文本预览",
  rtfNoText: "无法从文件中提取文本内容。",
  showErrorDetails: "查看错误详情",

  // EPUB
  noChaptersFound: "No Chapters Found",
  ebookLoadFailed: "Failed to Load E-book",
  unknownError: "未知错误",
  tableOfContents: "Table of Contents",
  foundInChapters: "Found in {count} chapter(s)",
  noResultsFound: "未找到结果",
  searchPlaceholder: "搜索...",

  // Shared fallback
  previewNotAvailable: "预览不可用",
  failedToLoadPreview: "预览加载失败",
  failedToReadFile: "文件读取失败",
  loadingCancelled: "加载已取消",
  copyCode: "复制代码",
  pptxFallbackTitle: "无法以高保真模式预览",
  pptxFallbackSemanticDesc: "高保真渲染失败，已切换到结构化预览。",
  pptxFallbackSummaryDesc: "高保真渲染失败，已切换到内容摘要。",
  pptxFallbackImages: "图片",
  pptxFallbackTextBlocks: "文本块",
  fallbackErrorDetails: "错误详情",
};

// ─── en-US ───

export const enUS: LocaleMessages = {
  // View mode bar
  preview: "Preview",
  source: "Source",
  split: "Split",

  // Common actions
  download: "Download",
  copy: "Copy",
  search: "Search...",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  reset: "Reset",
  fullscreen: "Fullscreen",
  previous: "Previous",
  next: "Next",

  // Page / slide units
  page: "page",
  pages: "pages",
  slideView: "Slide View",
  gridView: "Grid View",
  previousPage: "Previous Page (←)",
  nextPage: "Next Page (→)",

  // Loading states
  loadingPreview: "Loading preview...",
  loadingRtf: "Parsing RTF...",
  loadingSpreadsheet: "Parsing spreadsheet...",
  loadingEbook: "Loading e-book...",
  loadingPresentation: "Parsing presentation...",

  // Error states
  previewFailed: "Preview Failed",
  parseFailed: "Parse Failed",
  formatNotSupported: "Format Not Supported",

  // Legacy office formats
  legacyDocTitle: "Legacy Word format not supported",
  legacyPptTitle: "Legacy PowerPoint format not supported",
  legacyXlsTitle: "Legacy Excel format not supported",
  legacyDocDesc: "This file is in the legacy .doc binary format. Browser-side preview only supports .docx. Please use Word or WPS to save the file as .docx and try again.",
  legacyPptDesc: "This file is in the legacy .ppt binary format. Only the Open XML format (.pptx) is supported. Please use PowerPoint or WPS to save the file as .pptx and try again.",
  legacyXlsDesc: "This file is in the legacy .xls binary format. Only the Open XML format (.xlsx/.xlsm) is supported. Please use Excel or WPS to save the file as .xlsx and try again.",
  legacyXlsFallbackDesc: "This file is in the legacy .xls format. Some content may not display correctly. Please save as .xlsx for the best preview experience.",
  legacyXlsError: "This file is in the legacy .xls binary format. Only the Open XML format (.xlsx/.xlsm) is supported. Please use Excel or WPS to save the file as .xlsx and try again.",
  legacyXlsBanner: "Legacy Excel format not supported",
  unsupportedFileType: "File type ({fileType}) is not supported for browser-side preview.",

  // Large file
  largeFileHint: "This file is large. Browser-side parsing may take longer and the page may briefly freeze.",
  largeFile: "Large File",
  largeFileRows: "rows",
  largeFileCols: "cols",
  largeFileImages: "images",
  largeFileFastModeBanner: "This Excel file is large ({fileSize}). Fast mode is enabled by default: only the first {rowLimit} rows are rendered and image parsing is skipped.",
  largeFileFidelityBanner: "You are using fidelity mode to preview a large file. This may cause the browser to freeze.",
  largeFileFidelityConfirm: "This Excel file is {fileSize}. Fidelity mode may cause the browser to freeze or become unresponsive. Continue?",
  truncatedRows: "Data is large. Showing first {shown} of {total} rows",
  modeSelectionTitle: "Select Preview Mode",
  modeSelectionDesc: "This file is {fileSize}. Please select a preview mode:",
  modeSelectionFastMode: "Fast Mode",
  modeSelectionFastModeDesc: "Renders only the first 1000 rows, skips images and complex styles for faster loading",
  modeSelectionFidelityMode: "Fidelity Mode",
  modeSelectionFidelityModeDesc: "Preserves styles, images, and comments, but large files may cause lag",
  modeSelectionContinue: "Continue",

  // Pagination
  paginationInfo: "Showing {start}-{end} of {total} rows",
  paginationFirst: "First Page",
  paginationPrevious: "Previous Page",
  paginationPage: "Page {current} / {total}",
  paginationNext: "Next Page",
  paginationLast: "Last Page",
  paginationPageSize: "Page size:",

  // Spreadsheet
  sheetNotFound: "No Sheets Found",
  fastMode: "Fast",
  fidelityMode: "Fidelity",
  fastModeTitle: "Fast mode: limited rows, skip images and complex styles",
  fidelityModeTitle: "Fidelity mode: preserve styles, images, and comments",
  noData: "No data",
  noSearchResults: "No matching data found",
  comment: "Comment",
  unsupportedImageFormat: "Unsupported image format",
  unknown: "Unknown",
  downloadOriginal: "Download Original",
  enhancedRenderer: "Enhanced",
  tableRenderer: "Table",
  enhancedRendererTitle: "Enhanced mode: Excel-like spreadsheet renderer",
  tableRendererTitle: "Table mode: stable HTML table preview",
  enhancedRendererUnavailable: "Enhanced spreadsheet renderer is unavailable. Falling back to table preview.",

  // Plain text
  lines: "lines",
  wordWrapOn: "Enable word wrap",
  wordWrapOff: "Disable word wrap",
  copyContent: "Copy content",

  // Markdown
  oversizedCodeBlock: "Large code block",

  // RTF
  rtfFallback: "Rich text rendering unavailable, fallback to plain text preview",
  rtfNoText: "Unable to extract text content from file.",
  showErrorDetails: "Show error details",

  // EPUB
  noChaptersFound: "No Chapters Found",
  ebookLoadFailed: "Failed to Load E-book",
  unknownError: "Unknown error",
  tableOfContents: "Table of Contents",
  foundInChapters: "Found in {count} chapter(s)",
  noResultsFound: "No results found",
  searchPlaceholder: "Search...",

  // Shared fallback
  previewNotAvailable: "Preview Not Available",
  failedToLoadPreview: "Failed to Load Preview",
  failedToReadFile: "Failed to Read File",
  loadingCancelled: "Loading Cancelled",
  copyCode: "Copy code",
  pptxFallbackTitle: "High-fidelity preview unavailable",
  pptxFallbackSemanticDesc:
    "High-fidelity rendering failed. Showing approximate slide layout.",
  pptxFallbackSummaryDesc:
    "High-fidelity rendering failed. Showing content summary.",
  pptxFallbackImages: "images",
  pptxFallbackTextBlocks: "text blocks",
  fallbackErrorDetails: "Error details",
};

// ─── Context ───

import { createContext, useContext } from "react";

const defaultLocale = zhCN;

const LocaleContext = createContext<LocaleMessages>(defaultLocale);

/** Provider component — wrap your preview tree with this to override locale. */
export const LocaleProvider = LocaleContext.Provider;

/** Hook to access the current locale messages. */
export function useLocale(): LocaleMessages {
  return useContext(LocaleContext);
}

/** Get the default locale (zh-CN). */
export function getDefaultLocale(): LocaleMessages {
  return defaultLocale;
}
