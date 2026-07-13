/**
 * Excel preview — shared type definitions.
 *
 * These types are internal to the excel/ module family and the
 * XlsxPreview / XlsxTablePreview components.
 * They are NOT part of the public package API.
 */

export type XlsxPreviewMode = "fast" | "fidelity";

// ─── Table renderer types ───

export interface CellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontColor?: string;
  bgColor?: string;
  hAlign?: string;
  vAlign?: string;
  wrapText?: boolean;
  textRotation?: number;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  numFmt?: string;
  hyperlink?: string;
  comment?: string;
}

export interface EmbeddedImage {
  dataUrl: string | null;
  naturalWidth: number;
  naturalHeight: number;
  unsupported?: boolean;
  formatName?: string;
}

export interface CellData {
  value: string;
  style: CellStyle;
  colspan?: number;
  rowspan?: number;
  images?: EmbeddedImage[];
}

export interface SheetData {
  name: string;
  cellGrid: (CellData | null)[][];
  colWidths: number[];
  rowHeights: number[];
  totalRows: number;
  totalCols: number;
  imageCount: number;
  accRowHeights: number[];
  isLegacyXls?: boolean;
}

// ─── Workbook loading result ───

export interface ExcelWorkbookLoadResult {
  workbook: any; // ExcelJS Workbook — typed loosely to avoid hard dep
  isLegacyXls: boolean;
  /** Resolved theme colors from xl/theme/theme1.xml. Used by resolveColor. */
  themeColors: string[]; // indexed array: theme[index] → hex color
}
