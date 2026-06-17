/**
 * Excel preview — transform ExcelJS Workbook to x-data-spreadsheet data.
 *
 * Produces the data shape expected by x-data-spreadsheet's `loadData()`.
 * Reference: x-data-spreadsheet type definitions (SheetData, SpreadsheetData).
 *
 * Stage v2.1: images, comments, and hyperlinks are intentionally omitted.
 */

import { formatCellValue } from "./format-cell";
import { extractSpreadsheetStyle } from "./convert-style";
import type { XlsxPreviewMode, SpreadsheetSheetData, SpreadsheetWorkbookData, SpreadsheetStyle } from "./types";
import { XLSX_PREVIEW_LIMITS } from "../limits";

// Default dimensions matching x-data-spreadsheet defaults
const DEFAULT_COL_WIDTH = 80;
const DEFAULT_ROW_HEIGHT = 24;

export interface SpreadsheetTransformOptions {
  mode: XlsxPreviewMode;
  themeColors?: string[];
}

/**
 * Transform an ExcelJS Workbook into x-data-spreadsheet data.
 *
 * Returns a SpreadsheetWorkbookData that can be passed directly
 * to `spreadsheet.loadData(data)`.
 */
export function transformWorkbookToSpreadsheetData(
  workbook: any,
  options: SpreadsheetTransformOptions,
): SpreadsheetWorkbookData {
  const { mode, themeColors } = options;
  const isFast = mode === "fast";
  const fastRowLimit = isFast ? XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT : Infinity;

  const sheets: SpreadsheetSheetData[] = [];

  workbook.eachSheet((worksheet: any) => {
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;

    const sheetData: SpreadsheetSheetData = {
      name: worksheet.name,
      styles: [],
      rows: {},
      cols: {},
      merges: [],
    };

    // Style de-duplication cache
    const styleCache = new Map<string, number>();

    const pushStyle = (style: SpreadsheetStyle): number => {
      const key = JSON.stringify(style);
      const cached = styleCache.get(key);
      if (cached !== undefined) return cached;
      const index = sheetData.styles.length;
      sheetData.styles.push(style);
      styleCache.set(key, index);
      return index;
    };

    // ---- Collect merges ----
    const mergeSet = new Set<string>(); // merged cell keys (non-top-left)
    const mergeMap = new Map<string, [number, number]>(); // top-left key → [YRange, XRange]

    const _merges = (worksheet as any)._merges;
    if (_merges) {
      for (const [, merge] of Object.entries(_merges) as [string, any][]) {
        const m = merge?.model || merge;
        if (m?.top != null && m?.left != null) {
          const tlKey = `${m.top - 1}-${m.left - 1}`;
          mergeMap.set(tlKey, [m.bottom - m.top, m.right - m.left]);

          // Add to merges list for x-data-spreadsheet (A1:B2 format)
          const tlAddr = colNumToAddr(m.left - 1) + m.top;
          const brAddr = colNumToAddr(m.right - 1) + m.bottom;
          sheetData.merges.push(`${tlAddr}:${brAddr}`);

          for (let r = m.top; r <= m.bottom; r++) {
            for (let c = m.left; c <= m.right; c++) {
              if (r !== m.top || c !== m.left) {
                mergeSet.add(`${r - 1}-${c - 1}`);
              }
            }
          }
        }
      }
    }

    // Also handle model.merges (string format)
    const modelMerges = (worksheet as any).model?.merges;
    if (modelMerges?.length > 0 && typeof modelMerges[0] === "string") {
      const colLetterToNum = (s: string) => { let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; };
      for (const rangeStr of modelMerges) {
        const match = (rangeStr as string).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (match) {
          const top = parseInt(match[2]), left = colLetterToNum(match[1]);
          const bottom = parseInt(match[4]), right = colLetterToNum(match[3]);
          const tlKey = `${top - 1}-${left - 1}`;
          if (!mergeMap.has(tlKey)) {
            mergeMap.set(tlKey, [bottom - top, right - left]);
            sheetData.merges.push(rangeStr);
            for (let r = top; r <= bottom; r++) {
              for (let c = left; c <= right; c++) {
                if (r !== top || c !== left) {
                  mergeSet.add(`${r - 1}-${c - 1}`);
                }
              }
            }
          }
        }
      }
    }

    // ---- Process rows ----
    const effectiveRowCount = Math.min(rowCount, fastRowLimit);

    for (let r = 0; r < effectiveRowCount; r++) {
      const excelRow = worksheet.getRow(r + 1);

      // Skip hidden rows by adding a minimal height entry
      if ((excelRow as any)._hidden) {
        sheetData.rows[r] = { cells: {} };
        continue;
      }

      const rowEntry: { cells: Record<number, any> } = { cells: {} };

      // Row height
      if (excelRow.height) {
        (rowEntry as any).height = Math.round(excelRow.height * 1.333);
      }

      for (let c = 0; c < colCount; c++) {
        const key = `${r}-${c}`;

        // Skip merged non-top-left cells
        if (mergeSet.has(key)) continue;

        const cell = excelRow.getCell(c + 1);
        const rawText = formatCellValue(cell);
        // formatCellValue should always return a string, but guard against
        // unexpected object values that would crash x-data-spreadsheet.
        const text = typeof rawText === "string" ? rawText : String(rawText ?? "");

        const cellData: { text: string; style?: number; merge?: [number, number] } = {
          text,
        };

        // Merge info
        const merge = mergeMap.get(key);
        if (merge) {
          cellData.merge = merge;
        }

        // Style (skip in fast mode for performance)
        if (!isFast) {
          const style = extractSpreadsheetStyle(cell, themeColors);
          if (Object.keys(style).length > 0) {
            cellData.style = pushStyle(style);
          }
        }

        rowEntry.cells[c] = cellData;
      }

      sheetData.rows[r] = rowEntry;
    }

    // Set row count
    (sheetData.rows as any).len = Math.max(effectiveRowCount, 100);

    // ---- Process columns ----
    for (let c = 0; c < colCount; c++) {
      const col = worksheet.getColumn(c + 1);
      const colEntry: Record<string, unknown> = {};

      if ((col as any)._hidden) {
        colEntry.width = 0.1;
      } else if (col.width) {
        // ExcelJS column width is in character units.
        // x-data-spreadsheet uses pixel units.
        colEntry.width = Math.round(Math.max(col.width * 7.5, 50));
      } else {
        colEntry.width = DEFAULT_COL_WIDTH;
      }

      sheetData.cols[c] = colEntry;
    }

    (sheetData.cols as any).len = Math.max(colCount, 26);

    sheets.push(sheetData);
  });

  return { sheets };
}

/**
 * Convert a 0-based column index to an Excel column address (A, B, ..., Z, AA, AB, ...).
 */
function colNumToAddr(col: number): string {
  let result = "";
  col++;
  while (col > 0) {
    col--;
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26);
  }
  return result;
}
