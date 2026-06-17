/**
 * Excel preview — transform ExcelJS Workbook to table renderer data.
 *
 * This is the core of the original `parseXlsx()` function, extracted
 * for reuse and separation from the React component.
 */

import { formatCellValue } from "./format-cell";
import { extractStyle } from "./convert-style";
import {
  BROWSER_SUPPORTED_FORMATS,
  bufferToBase64,
  detectImageFormat,
  getMimeType,
  parseImageDimensions,
} from "./media";
import type { CellData, CellStyle, EmbeddedImage, SheetData, XlsxPreviewMode } from "./types";
import { XLSX_PREVIEW_LIMITS } from "../limits";

// ─── Constants ───

export const ROW_NUM_COL_WIDTH = 45;
export const HEADER_ROW_HEIGHT = 22;
export const DEFAULT_ROW_HEIGHT = 22;
export const DEFAULT_COL_WIDTH = 80;
/** Fidelity mode DOM rendering protection; fast mode is already limited by FAST_MODE_ROW_LIMIT at parse time. */
export const MAX_RENDER_ROWS = 5000;

// ─── Transform ───

export interface TableTransformOptions {
  mode: XlsxPreviewMode;
  isLegacyXls?: boolean;
  themeColors?: string[];
}

/**
 * Transform an ExcelJS Workbook into SheetData[] for the HTML table renderer.
 *
 * This preserves the exact same behavior as the original `parseXlsx()` function.
 */
export function transformWorkbookToTableSheets(
  workbook: any,
  options: TableTransformOptions,
): SheetData[] {
  const { mode, isLegacyXls = false, themeColors } = options;
  const sheets: SheetData[] = [];
  const isFast = mode === "fast";
  const fastRowLimit = isFast ? XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT : Infinity;

  workbook.eachSheet((worksheet: any) => {
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;

    if (rowCount === 0 || colCount === 0) {
      sheets.push({ name: worksheet.name, cellGrid: [], colWidths: [], rowHeights: [], totalRows: 0, totalCols: 0, imageCount: 0, accRowHeights: [], isLegacyXls });
      return;
    }

    const effectiveRowCount = Math.min(rowCount, fastRowLimit);

    // Column widths
    const colWidths: number[] = [];
    for (let c = 1; c <= colCount; c++) {
      const col = worksheet.getColumn(c);
      colWidths.push(col.width ? Math.round(Math.max(col.width * 7.5, 50)) : DEFAULT_COL_WIDTH);
    }

    // Row heights (only up to effectiveRowCount in fast mode)
    const rowHeights: number[] = [];
    for (let r = 1; r <= effectiveRowCount; r++) {
      const row = worksheet.getRow(r);
      rowHeights.push(row.height ? Math.round(row.height * 1.333) : 0);
    }

    // Accumulated row heights
    const accRowHeights: number[] = [];
    let accRow = 0;
    for (let r = 0; r < rowHeights.length; r++) { accRowHeights.push(accRow); accRow += rowHeights[r] || DEFAULT_ROW_HEIGHT; }
    accRowHeights.push(accRow);

    // ---- Merge ranges ----
    const merges: Map<string, { rs: number; cs: number }> = new Map();
    const mergedCells = new Set<string>();
    // Map from any cell in a merge to the top-left cell key
    const mergeRedirect: Map<string, string> = new Map();

    const _merges = (worksheet as any)._merges;
    if (_merges) {
      for (const [, merge] of Object.entries(_merges) as [string, any][]) {
        const m = merge?.model || merge;
        if (m?.top != null && m?.left != null) {
          const tlKey = `${m.top - 1}-${m.left - 1}`;
          merges.set(tlKey, { rs: m.bottom - m.top + 1, cs: m.right - m.left + 1 });
          for (let r = m.top; r <= m.bottom; r++) {
            for (let c = m.left; c <= m.right; c++) {
              if (r !== m.top || c !== m.left) {
                const mergedKey = `${r - 1}-${c - 1}`;
                mergedCells.add(mergedKey);
                mergeRedirect.set(mergedKey, tlKey);
              }
            }
          }
        }
      }
    }
    const modelMerges = (worksheet as any).model?.merges;
    if (modelMerges?.length > 0 && typeof modelMerges[0] === "string") {
      const colLetterToNum = (s: string) => { let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; };
      for (const rangeStr of modelMerges) {
        const match = (rangeStr as string).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (match) {
          const top = parseInt(match[2]), left = colLetterToNum(match[1]);
          const bottom = parseInt(match[4]), right = colLetterToNum(match[3]);
          const tlKey = `${top - 1}-${left - 1}`;
          if (!merges.has(tlKey)) {
            merges.set(tlKey, { rs: bottom - top + 1, cs: right - left + 1 });
            for (let r = top; r <= bottom; r++) {
              for (let c = left; c <= right; c++) {
                if (r !== top || c !== left) {
                  const mergedKey = `${r - 1}-${c - 1}`;
                  mergedCells.add(mergedKey);
                  mergeRedirect.set(mergedKey, tlKey);
                }
              }
            }
          }
        }
      }
    }

    // ---- Extract images & group by anchor cell (fidelity mode only) ----
    const cellImages = new Map<string, EmbeddedImage[]>();
    let totalImages = 0;

    if (!isFast) {
      try {
        const wsImages = worksheet.getImages();
        for (const img of wsImages) {
          const imageId = parseInt(img.imageId, 10);
          if (isNaN(imageId)) continue;
          const imageData = workbook.getImage(imageId);
          if (!imageData?.buffer) continue;

          const buf = imageData.buffer;
          const format = detectImageFormat(buf);
          const isSupported = BROWSER_SUPPORTED_FORMATS.has(format);
          const mimeType = getMimeType(format);
          const base64 = bufferToBase64(buf);

          const range = img.range;
          if (!range?.tl) continue;

          const tlRow = range.tl.nativeRow ?? 0;
          const tlCol = range.tl.nativeCol ?? 0;
          const key = `${tlRow}-${tlCol}`;

          const effectiveKey = mergeRedirect.get(key) || key;

          const dims = parseImageDimensions(buf);

          const embedded: EmbeddedImage = {
            dataUrl: isSupported ? `data:${mimeType};base64,${base64}` : null,
            naturalWidth: dims.width,
            naturalHeight: dims.height,
            unsupported: !isSupported,
            formatName: format.toUpperCase(),
          };

          if (!cellImages.has(effectiveKey)) cellImages.set(effectiveKey, []);
          cellImages.get(effectiveKey)!.push(embedded);
          totalImages++;
        }
      } catch (err) {
        console.warn("Image extraction error:", err);
      }
    }

    // ---- Build cell grid ----
    const cellGrid: (CellData | null)[][] = [];

    for (let r = 0; r < effectiveRowCount; r++) {
      const row: (CellData | null)[] = [];
      const excelRow = worksheet.getRow(r + 1);

      for (let c = 0; c < colCount; c++) {
        const key = `${r}-${c}`;
        if (mergedCells.has(key)) { row.push(null); continue; }

        const cell = excelRow.getCell(c + 1);
        const rawValue = formatCellValue(cell);
        // formatCellValue should always return a string, but guard against
        // unexpected object values that would crash React rendering.
        const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
        const style: CellStyle = isFast ? {} : extractStyle(cell, themeColors);
        const merge = merges.get(key);
        const images = cellImages.get(key);

        row.push({
          value,
          style,
          colspan: merge?.cs,
          rowspan: merge?.rs,
          images: images && images.length > 0 ? images : undefined,
        });
      }
      cellGrid.push(row);
    }

    sheets.push({
      name: worksheet.name,
      cellGrid,
      colWidths,
      rowHeights,
      totalRows: rowCount,
      totalCols: colCount,
      imageCount: totalImages,
      accRowHeights,
      isLegacyXls,
    });
  });

  return sheets;
}

/**
 * Convert a 0-based column index to Excel column letter (A, B, ..., Z, AA, AB, ...).
 */
export function colNumToLetter(num: number): string {
  let result = "";
  num++;
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}
