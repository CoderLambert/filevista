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
import { normalizeCommentsForExcelJs } from "./normalize-comments";

// Lazy-load ExcelJS
type ExcelJSModule = typeof import("exceljs");
let ExcelJS: ExcelJSModule | null = null;

async function getExcelJS(): Promise<ExcelJSModule> {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

export function isExcelJsCommentReconcileError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { name?: unknown; message?: unknown };
  return (
    candidate.name === "TypeError" &&
    typeof candidate.message === "string" &&
    /comments/i.test(candidate.message)
  );
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
      if (!EJS) {
        throw new Error("ExcelJS module failed to load.");
      }
      // ESM/CJS interop: some bundlers wrap the CJS module as { default: Module }
      // rather than spreading the namespace onto the import itself. Fall back
      // to `EJS.Workbook` for the standard ESM case, but prefer `.default.Workbook`
      // when the wrapper shape is detected.
      const mod = EJS as ExcelJSModule & {
        default?: { Workbook: ExcelJSModule["Workbook"] };
      };
      const Workbook = mod.default?.Workbook ?? EJS.Workbook;
      const wb = new Workbook();
      try {
        await wb.xlsx.load(buffer);
        return wb;
      } catch (error) {
        if (!isExcelJsCommentReconcileError(error)) throw error;

        const normalizedBuffer = await normalizeCommentsForExcelJs(buffer);
        if (!normalizedBuffer) throw error;

        const normalizedWorkbook = new Workbook();
        await normalizedWorkbook.xlsx.load(normalizedBuffer);
        return normalizedWorkbook;
      }
    })(),
    extractWorkbookTheme(buffer),
  ]);

  const ext = fileName.toLowerCase().split(".").pop() || "";
  const isLegacyXls = ext === "xls";

  return { workbook, isLegacyXls, themeColors: themeColorsToArray(theme) };
}
