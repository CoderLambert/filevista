/**
 * Excel preview — dynamic loader for x-data-spreadsheet.
 *
 * The x-data-spreadsheet package is an optional enhancement for
 * Excel rendering. When missing, the table renderer works as fallback.
 *
 * NOTE: We import from "x-data-spreadsheet/dist/xspreadsheet" instead of
 * the package default entry. The default entry points to src/index.js and
 * imports .less files, which breaks some bundlers (notably Next.js Turbopack).
 */

type SpreadsheetCtor = any;

let spreadsheetPromise: Promise<SpreadsheetCtor> | null = null;

function normalizeModule(mod: any): SpreadsheetCtor {
  const globalFactory = typeof window !== "undefined"
    ? (window as any).x_spreadsheet
    : undefined;

  const candidates = [
    mod?.default?.default,
    mod?.default,
    mod,
    globalFactory,
  ];

  const ctor = candidates.find((item) => typeof item === "function");
  if (!ctor) {
    throw new Error("x-data-spreadsheet did not export a constructor");
  }

  return ctor;
}

/**
 * Load the x-data-spreadsheet constructor.
 * Caches the promise so repeated calls share the same import.
 * Throws on missing module or other import errors.
 */
export async function loadXDataSpreadsheet(): Promise<SpreadsheetCtor> {
  spreadsheetPromise ??= import("x-data-spreadsheet/dist/xspreadsheet").then(normalizeModule);
  return spreadsheetPromise;
}

/**
 * Safely attempt to load x-data-spreadsheet.
 * Returns null if the package is missing or import fails.
 * Never throws — designed for renderer selection logic.
 */
export async function tryLoadXDataSpreadsheet(): Promise<SpreadsheetCtor | null> {
  try {
    return await loadXDataSpreadsheet();
  } catch {
    return null;
  }
}
