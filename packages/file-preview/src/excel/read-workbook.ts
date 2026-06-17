/**
 * Excel preview — workbook loading utility.
 *
 * Reads binary source data and loads an ExcelJS Workbook.
 * Extracted from XlsxPreview.tsx for reuse across renderers.
 */

import { readBinaryPreviewAsUint8Array } from "../core/binary";
import type { PreviewSource } from "../core/types";
import type { ExcelWorkbookLoadResult } from "./types";
import { extractWorkbookTheme, themeColorsToArray } from "./theme";

// Lazy-load ExcelJS
let ExcelJS: typeof import("exceljs") | null = null;

async function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

/**
 * Read an Excel source and return a loaded ExcelJS Workbook.
 *
 * For `.xls` files (legacy binary format), this will still fail because
 * ExcelJS only supports `.xlsx`. Future `.xls` conversion support
 * can be added here (Stage v2.2).
 */
export async function readXlsxWorkbook(
  input: { source?: PreviewSource; content?: string | null },
  fileName: string,
): Promise<ExcelWorkbookLoadResult> {
  const bytes = await readBinaryPreviewAsUint8Array(input);

  // Extract the underlying ArrayBuffer (slice to avoid shared buffer issues)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  // Parse theme colors from xl/theme/theme1.xml in parallel with workbook loading
  const [workbook, theme] = await Promise.all([
    (async () => {
      const EJS = await getExcelJS();
      const wb = new EJS.Workbook();
      await wb.xlsx.load(buffer);
      return wb;
    })(),
    extractWorkbookTheme(buffer),
  ]);

  const ext = fileName.toLowerCase().split(".").pop() || "";
  const isLegacyXls = ext === "xls";

  return { workbook, isLegacyXls, themeColors: themeColorsToArray(theme) };
}
