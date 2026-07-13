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
type ExcelJSModule = typeof import("exceljs");
let ExcelJS: ExcelJSModule | null = null;

async function getExcelJS(): Promise<ExcelJSModule> {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

function isExcelJsCommentRelationshipError(error: unknown): boolean {
  return error instanceof TypeError &&
    /undefined \(reading ['"]comments['"]\)/i.test(error.message);
}

/**
 * Some spreadsheet generators store legacy comments under paths such as
 * `xl/comments/comment1.xml` and reference them with absolute relationship
 * targets. ExcelJS 4.x only indexes the conventional `xl/comments1.xml` and
 * relative target form. Add conventional aliases in an in-memory copy so the
 * workbook remains readable without changing the source file or losing notes.
 */
async function normalizeCommentPartsForExcelJs(buffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  const imported = await import("jszip");
  const JSZip = imported.default;
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  const aliases = new Map<string, string>();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    let match = path.match(/^xl\/comments\/comment(\d+)\.xml$/i);
    if (match) {
      aliases.set(path, `xl/comments${match[1]}.xml`);
      continue;
    }

    match = path.match(/^xl\/drawings\/commentsDrawing(\d+)\.vml$/i);
    if (match) aliases.set(path, `xl/drawings/vmlDrawing${match[1]}.vml`);
  }

  for (const [sourcePath, aliasPath] of aliases) {
    const source = zip.file(sourcePath);
    if (!source || zip.file(aliasPath)) continue;
    zip.file(aliasPath, await source.async("uint8array"));
    changed = true;
  }

  const normalizeTarget = (target: string): string => {
    let match = target.match(/^\/?xl\/comments\/comment(\d+)\.xml$/i);
    if (match) return `../comments${match[1]}.xml`;

    match = target.match(/^\/?xl\/comments(\d+)\.xml$/i);
    if (match) return `../comments${match[1]}.xml`;

    match = target.match(/^\/?xl\/drawings\/commentsDrawing(\d+)\.vml$/i);
    if (match) return `../drawings/vmlDrawing${match[1]}.vml`;

    match = target.match(/^\/?xl\/drawings\/vmlDrawing(\d+)\.vml$/i);
    if (match) return `../drawings/vmlDrawing${match[1]}.vml`;

    return target;
  };

  const worksheetRels = Object.values(zip.files).filter((entry) =>
    /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/i.test(entry.name)
  );

  for (const entry of worksheetRels) {
    const xml = await entry.async("string");
    const normalized = xml.replace(
      /\bTarget\s*=\s*(["'])([^"']+)\1/gi,
      (attribute, quote: string, target: string) => {
        const nextTarget = normalizeTarget(target);
        return nextTarget === target
          ? attribute
          : `Target=${quote}${nextTarget}${quote}`;
      },
    );
    if (normalized !== xml) {
      zip.file(entry.name, normalized);
      changed = true;
    }
  }

  if (!changed) return null;
  return zip.generateAsync({ type: "arraybuffer" });
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
        if (!isExcelJsCommentRelationshipError(error)) throw error;

        const normalized = await normalizeCommentPartsForExcelJs(buffer);
        if (!normalized) throw error;

        const retryWorkbook = new Workbook();
        await retryWorkbook.xlsx.load(normalized);
        return retryWorkbook;
      }
    })(),
    extractWorkbookTheme(buffer),
  ]);

  const ext = fileName.toLowerCase().split(".").pop() || "";
  const isLegacyXls = ext === "xls";

  return { workbook, isLegacyXls, themeColors: themeColorsToArray(theme) };
}
