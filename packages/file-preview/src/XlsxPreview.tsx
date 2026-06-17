import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  SearchIcon,
  Table2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  ImageOffIcon,
  MessageSquareIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
} from "./icons";
import "./styles/XlsxPreview.css";
import { XLSX_PREVIEW_LIMITS } from "./limits";
import { readBinaryPreviewAsUint8Array } from "./core/binary";
import type { PreviewSource } from "./core/types";
import { formatFileSize } from "./utils";
import { useLocale } from "./core/i18n";

// Lazy-load ExcelJS
let ExcelJS: typeof import("exceljs") | null = null;
async function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

interface XlsxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
  fileSize: number;
}

type XlsxPreviewMode = "fast" | "fidelity";

interface CellStyle {
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

interface EmbeddedImage {
  dataUrl: string | null;
  naturalWidth: number;
  naturalHeight: number;
  unsupported?: boolean;
  formatName?: string;
}

interface CellData {
  value: string;
  style: CellStyle;
  colspan?: number;
  rowspan?: number;
  images?: EmbeddedImage[];
}

interface SheetData {
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

// ---- Extended Theme Colors ----
const THEME_COLORS: Record<number, string> = {
  0: "#000000", 1: "#FFFFFF", 2: "#44546A", 3: "#E7E6E6",
  4: "#4472C4", 5: "#ED7D31", 6: "#A5A5A5", 7: "#FFC000",
  8: "#5B9BD5", 9: "#70AD47",
  10: "#F2F2F2", 11: "#D9D9D9", 12: "#BFBFBF", 13: "#A6A6A6",
  14: "#808080", 15: "#595959", 16: "#404040", 17: "#262626",
};

// ---- Indexed Colors ----
const INDEXED_COLORS: string[] = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#C0C0C0", "#808080",
  "#9999FF", "#993366", "#FFFFCC", "#CCFFFF", "#660066", "#FF8080", "#0066CC", "#CCCCFF",
  "#000080", "#FF00FF", "#FFFF00", "#00FFFF", "#800080", "#800000", "#008080", "#0000FF",
  "#00CCFF", "#CCFFFF", "#CCFFCC", "#FFFF99", "#99CCFF", "#FF99CC", "#CC99FF", "#FFCC99",
  "#3366FF", "#33CCCC", "#99CC00", "#FFCC00", "#FF9900", "#FF6600", "#666699", "#969696",
  "#003366", "#339966", "#003300", "#333300", "#993300", "#993366", "#333399", "#333333",
];

function applyTint(hex: string, tint: number | undefined): string {
  if (!tint) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = (c: number) => tint < 0 ? Math.round(c * (1 + tint)) : Math.round(c + (255 - c) * tint);
  return `#${t(r).toString(16).padStart(2, "0")}${t(g).toString(16).padStart(2, "0")}${t(b).toString(16).padStart(2, "0")}`;
}

function resolveColor(color: any): string | undefined {
  if (!color) return undefined;
  if (color.argb) {
    const a = color.argb;
    if (!a || a === "00000000" || a === "FFFFFFFF") return undefined;
    return a.length === 8 ? "#" + a.slice(2).toLowerCase() : a.toLowerCase();
  }
  if (color.theme !== undefined) return applyTint(THEME_COLORS[color.theme] || "#000000", color.tint);
  if (color.indexed !== undefined && INDEXED_COLORS[color.indexed]) return applyTint(INDEXED_COLORS[color.indexed], color.tint);
  if (typeof color === "string") return color;
  return undefined;
}

function borderCss(part: any): string {
  if (!part?.style || part.style === "none") return "";
  const w = part.style === "thin" ? "1px" : part.style === "medium" ? "2px" :
    part.style === "thick" ? "3px" : part.style === "hair" ? "0.5px" :
    part.style === "double" ? "3px" : part.style.startsWith("medium") ? "2px" : "1px";
  const c = resolveColor(part.color) || "#000000";
  const s = /dashed|dotted|dashDot/.test(part.style) ? "dashed" : "solid";
  return `${w} ${s} ${c}`;
}

// ---- Image helpers ----
function parseImageDimensions(buffer: any): { width: number; height: number } {
  const bytes = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer)
    : new Uint8Array(Buffer.from(buffer));
  if (bytes.length < 10) return { width: 0, height: 0 };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes.length > 24) {
    return { width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] };
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    for (let i = 0; i < Math.min(bytes.length - 9, 65536); i++) {
      if (bytes[i] === 0xFF) {
        const m = bytes[i + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
        }
      }
    }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4D && bytes.length > 25) {
    return { width: bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24), height: bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24) };
  }
  return { width: 0, height: 0 };
}

type ImageFormat = "png" | "jpeg" | "gif" | "bmp" | "emf" | "wmf" | "tiff" | "webp" | "svg" | "unknown";
const BROWSER_SUPPORTED_FORMATS = new Set(["png", "jpeg", "gif", "bmp", "webp", "svg"]);

function detectImageFormat(buffer: any): ImageFormat {
  const bytes = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer)
    : new Uint8Array(Buffer.from(buffer));
  if (bytes.length < 4) return "unknown";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return "bmp";
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A) || (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00)) return "tiff";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x00 && bytes.length > 44) return "emf";
  if ((bytes[0] === 0xD7 && bytes[1] === 0xCD && bytes[2] === 0xC6 && bytes[3] === 0x9A) || (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x09 && bytes[3] === 0x00)) return "wmf";
  return "unknown";
}

function getMimeType(format: ImageFormat): string {
  const map: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", tiff: "image/tiff" };
  return map[format] || "image/png";
}

function bufferToBase64(buf: any): string {
  if (buf instanceof Uint8Array || buf instanceof ArrayBuffer) {
    const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < arr.length; i += 8192) {
      const chunk = arr.subarray(i, Math.min(i + 8192, arr.length));
      bin += String.fromCharCode(...chunk);
    }
    return btoa(bin);
  }
  if (typeof buf === "string") return buf;
  return (buf as any).toString("base64");
}

// ---- Cell Value Formatting ----
function formatCellValue(cell: any): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Error) return v.message || "#ERROR";
  if (typeof v === "object" && v !== null && "richText" in v) return v.richText.map((r: any) => r.text).join("");
  if (typeof v === "object" && v !== null && "formula" in v) {
    const r = v.result;
    return r !== null && r !== undefined ? String(r) : "";
  }
  if (typeof v === "object" && v !== null && "hyperlink" in v) return v.text || v.hyperlink;
  if (v instanceof Date) return formatDateValue(v, cell.numFmt);
  if (typeof v === "number") return formatNumberValue(v, cell.numFmt);
  return String(v);
}

function formatDateValue(d: Date, fmt: string | undefined): string {
  if (!fmt || !/[yYmdhHs]/.test(fmt)) return d.toLocaleDateString("zh-CN");
  try {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let res = fmt;
    const is12Hour = /am\/pm/i.test(res);
    res = res.replace(/AM\/PM/gi, "").replace(/A\/P/gi, "");
    res = res.replace(/mmmm/g, monthsShort[d.getMonth()]);
    res = res.replace(/mmm/g, monthsShort[d.getMonth()]);
    res = res.replace(/dddd/g, daysShort[d.getDay()]);
    res = res.replace(/ddd/g, daysShort[d.getDay()]);
    res = res.replace(/yyyy/g, d.getFullYear().toString());
    res = res.replace(/yy/g, d.getFullYear().toString().slice(-2));
    const parts = res.split(/hh/i);
    if (parts.length > 1) {
      parts[0] = parts[0].replace(/mm/g, pad(d.getMonth() + 1));
      parts[1] = parts[1].replace(/mm/g, pad(d.getMinutes()));
      res = parts.join("hh");
    } else {
      res = res.replace(/mm/g, pad(d.getMonth() + 1));
    }
    res = res.replace(/dd/g, pad(d.getDate()));
    let hours = d.getHours();
    if (is12Hour) { const ampm = hours >= 12 ? "PM" : "AM"; hours = hours % 12 || 12; res += " " + ampm; }
    res = res.replace(/hh/gi, pad(hours));
    res = res.replace(/ss/g, pad(d.getSeconds()));
    res = res.replace(/[\\]/g, "").replace(/[\[\]]/g, "");
    return res;
  } catch { return d.toLocaleDateString("zh-CN"); }
}

function formatNumberValue(v: number, fmt: string | undefined): string {
  if (!fmt || fmt === "General" || fmt === "@") return v.toString();
  if (fmt.includes("%")) { const z = fmt.split("%")[0].match(/0/g)?.length ?? 1; return (v * 100).toFixed(Math.max(0, z - 1)) + "%"; }
  if (fmt.includes("/")) return formatFraction(v, fmt);
  if (/e\+/i.test(fmt)) { const dec = fmt.split(/[eE]/)[0].split(".")[1]?.replace(/[^0]/g, "").length || 0; return v.toExponential(dec); }
  const hasCurrency = /[$¥€£]/.test(fmt);
  const currencySymbol = fmt.match(/[$¥€£]/)?.[0] || "";
  const hasThousands = fmt.includes("#,##0") || fmt.includes("# ##0") || fmt.includes(",0");
  const decPart = fmt.split(".")[1];
  const decPlaces = decPart ? (decPart.match(/0/g) || []).length : 0;
  const hasNegativeParens = fmt.includes(");(") || fmt.includes(");-(");
  let result: string;
  if (hasThousands) { result = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decPlaces, maximumFractionDigits: decPlaces }); }
  else if (decPlaces > 0) { result = Math.abs(v).toFixed(decPlaces); }
  else { result = Math.abs(v).toString(); }
  if (v < 0) result = hasNegativeParens ? `(${result})` : `-${result}`;
  if (hasCurrency) { if (fmt.indexOf(currencySymbol) < fmt.indexOf("0") || fmt.indexOf(currencySymbol) < fmt.indexOf("#")) result = currencySymbol + result; else result = result + currencySymbol; }
  return result;
}

function formatFraction(v: number, fmt: string): string {
  const denom = fmt.includes("??/??") ? 100 : fmt.includes("?/?") || fmt.includes("?/") ? 10 : 10;
  const whole = Math.floor(Math.abs(v));
  const frac = Math.abs(v) - whole;
  const num = Math.round(frac * denom);
  if (num === 0) return whole.toString();
  const g = gcd(num, denom);
  const n = num / g, d = denom / g;
  if (whole > 0) return `${whole} ${n}/${d}`;
  return (v < 0 ? "-" : "") + `${n}/${d}`;
}

function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }

// ---- Style Extraction ----
function extractStyle(cell: any): CellStyle {
  const s: CellStyle = {};
  const f = cell.font;
  if (f) {
    if (f.name) s.fontFamily = f.name;
    if (f.size) s.fontSize = f.size;
    if (f.bold) s.bold = true;
    if (f.italic) s.italic = true;
    if (f.underline) s.underline = true;
    const fc = resolveColor(f.color); if (fc) s.fontColor = fc;
  }
  const fill = cell.fill;
  if (fill?.pattern && fill.pattern !== "none") {
    const fg = resolveColor(fill.fgColor), bg = resolveColor(fill.bgColor);
    s.bgColor = fg || bg;
  }
  const a = cell.alignment;
  if (a) {
    if (a.horizontal && a.horizontal !== "fill") s.hAlign = a.horizontal;
    if (a.vertical) s.vAlign = a.vertical;
    if (a.wrapText) s.wrapText = true;
    if (a.textRotation) s.textRotation = a.textRotation;
  }
  const b = cell.border;
  if (b) {
    if (b.top) s.borderTop = borderCss(b.top);
    if (b.right) s.borderRight = borderCss(b.right);
    if (b.bottom) s.borderBottom = borderCss(b.bottom);
    if (b.left) s.borderLeft = borderCss(b.left);
  }
  if (cell.numFmt) s.numFmt = cell.numFmt;
  if (cell.hyperlink) {
    s.hyperlink = typeof cell.hyperlink === "string" ? cell.hyperlink : cell.hyperlink.target;
  } else if (cell.value !== null && typeof cell.value === "object" && "hyperlink" in cell.value) {
    s.hyperlink = cell.value.hyperlink;
  }
  if (cell.note) {
    if (typeof cell.note === "string") s.comment = cell.note;
    else if (cell.note.texts) s.comment = cell.note.texts.map((t: any) => t.text || t).join("");
  }
  return s;
}

function styleToCss(style: CellStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.fontFamily) css.fontFamily = `"${style.fontFamily}", sans-serif`;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.bold) css.fontWeight = "bold";
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.fontColor) css.color = style.fontColor;
  if (style.bgColor && !/^#ffffff$/i.test(style.bgColor)) css.backgroundColor = style.bgColor;
  if (style.hAlign) css.textAlign = style.hAlign as any;
  if (style.vAlign) css.verticalAlign = style.vAlign === "middle" ? "middle" : style.vAlign as any;
  if (style.wrapText) css.whiteSpace = "pre-wrap";
  if (style.textRotation) {
    css[style.textRotation === 255 ? "writingMode" : "transform"] =
      style.textRotation === 255 ? "vertical-rl" as any : `rotate(-${style.textRotation}deg)`;
  }
  return css;
}

const ROW_NUM_COL_WIDTH = 45;
const HEADER_ROW_HEIGHT = 22;
const DEFAULT_ROW_HEIGHT = 22;
const DEFAULT_COL_WIDTH = 80;
// Fidelity mode DOM rendering protection; fast mode is already limited by FAST_MODE_ROW_LIMIT at parse time.
const MAX_RENDER_ROWS = 5000;

// ---- Main Parser ----
async function parseXlsx(
  input: { source?: PreviewSource; content?: string | null },
  fileName: string,
  mode: XlsxPreviewMode
): Promise<SheetData[]> {
  const EJS = await getExcelJS();
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const isLegacyXls = ext === "xls";

  const bytes = await readBinaryPreviewAsUint8Array(input);

  const workbook = new EJS.Workbook();
  // exceljs's typings ask for Node's Buffer, but its browser bundle
  // accepts any ArrayBufferView at runtime. Pass the underlying ArrayBuffer
  // to satisfy both layers without a structured cast.
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);

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
        const value = formatCellValue(cell);
        const style: CellStyle = isFast ? {} : extractStyle(cell);
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

function colNumToLetter(num: number): string {
  let result = "";
  num++;
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function XlsxPreview({ content, source, fileName, fileSize }: XlsxPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredComment, setHoveredComment] = useState<{ row: number; col: number; text: string; x: number; y: number } | null>(null);
  const t = useLocale();

  const [mode, setMode] = useState<XlsxPreviewMode>(() => {
    return fileSize > XLSX_PREVIEW_LIMITS.LARGE_FILE_SIZE ? "fast" : "fidelity";
  });

  const isLargeFile = fileSize > XLSX_PREVIEW_LIMITS.LARGE_FILE_SIZE;
  const isTooLargeForFidelity = fileSize > XLSX_PREVIEW_LIMITS.MAX_FIDELITY_FILE_SIZE;

  const switchMode = useCallback(
    (nextMode: XlsxPreviewMode) => {
      if (nextMode === mode) return;
      if (nextMode === "fidelity" && isTooLargeForFidelity) {
        const confirmed = window.confirm(
          t.largeFileFidelityConfirm.replace("{fileSize}", formatFileSize(fileSize))
        );
        if (!confirmed) return;
      }
      setMode(nextMode);
    },
    [mode, isTooLargeForFidelity, fileSize]
  );

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Reset loading state during render when inputs change — derived state, not effect
  const [prevDeps, setPrevDeps] = useState({ content, source, fileName, mode });
  if (
    prevDeps.content !== content ||
    prevDeps.source !== source ||
    prevDeps.fileName !== fileName ||
    prevDeps.mode !== mode
  ) {
    setPrevDeps({ content, source, fileName, mode });
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    parseXlsx({ source, content }, fileName, mode).then(
      (result) => {
        if (cancelled) return;
        setSheets(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("XLSX parse error:", err);
        const ext = fileName.toLowerCase().split(".").pop() || "";
        if (ext === "xls") {
          setError(t.legacyXlsError);
        } else {
          setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
        }
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [content, source, fileName, mode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeSheet]);

  const currentSheet = sheets[activeSheet];

  const filteredRowIndices = useMemo(() => {
    if (!currentSheet || !debouncedSearch) return null;
    const indices: number[] = [];
    const term = debouncedSearch.toLowerCase();
    currentSheet.cellGrid.forEach((row, idx) => {
      const match = row.some((cell) => cell && (cell.value.toLowerCase().includes(term) || (cell.images && cell.images.length > 0)));
      if (match) indices.push(idx);
    });
    return indices;
  }, [currentSheet, debouncedSearch]);

  const showLegacyWarning = currentSheet?.isLegacyXls && !error;

  if (loading) {
    return (
      <div className="fv-xlsx__state">
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-xlsx__state-msg">{t.loadingSpreadsheet}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="fv-xlsx__state fv-xlsx__state--error">
        <AlertTriangleIcon size={36} />
        <p className="fv-xlsx__state-title">{t.parseFailed}</p>
        <p className="fv-xlsx__state-msg">{error}</p>
      </div>
    );
  }
  if (sheets.length === 0) {
    return (
      <div className="fv-xlsx__state fv-xlsx__state--empty">
        <p className="fv-xlsx__state-title">{t.sheetNotFound}</p>
      </div>
    );
  }

  const rows = currentSheet?.cellGrid || [];
  const isSearch = !!filteredRowIndices;
  const allDisplayRows = isSearch
    ? filteredRowIndices!.map((idx) => ({ row: rows[idx], originalIdx: idx }))
    : rows.map((row, idx) => ({ row, originalIdx: idx }));

  const isTruncated = !isSearch && allDisplayRows.length > MAX_RENDER_ROWS;
  const displayRows = isTruncated ? allDisplayRows.slice(0, MAX_RENDER_ROWS) : allDisplayRows;

  const totalCols = currentSheet?.totalCols || 0;
  const allColWidths = currentSheet?.colWidths || [];

  return (
    <div className="fv-xlsx">
      {showLegacyWarning && (
        <div className="fv-xlsx__legacy-banner">
          <AlertTriangleIcon size={14} />
          <span>{t.legacyXlsFallbackDesc}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="fv-xlsx__toolbar">
        <div className="fv-xlsx__toolbar-left">
          <Table2Icon size={14} />
          {sheets.length > 1 && (
            <div className="fv-xlsx__sheet-tabs">
              {sheets.map((sheet, i) => (
                <button key={i} onClick={() => { setActiveSheet(i); setSearchTerm(""); }}
                  className={`fv-xlsx__sheet-tab ${i === activeSheet ? "fv-xlsx__sheet-tab--active" : ""}`}>
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
          {/* Mode switch */}
          <div className="fv-xlsx__mode-switch">
            <button
              onClick={() => switchMode("fast")}
              className={`fv-xlsx__mode-btn ${mode === "fast" ? "fv-xlsx__mode-btn--active" : ""}`}
              title={t.fastModeTitle}
            >
              {t.fastMode}
            </button>
            <button
              onClick={() => switchMode("fidelity")}
              className={`fv-xlsx__mode-btn ${mode === "fidelity" ? "fv-xlsx__mode-btn--active" : ""}`}
              title={t.fidelityModeTitle}
            >
              {t.fidelityMode}
            </button>
          </div>
        </div>
        <div className="fv-xlsx__toolbar-right">
          <div className="fv-xlsx__search-wrap">
            <SearchIcon size={14} className="fv-xlsx__search-icon" />
            <input type="text" placeholder={t.search} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="fv-xlsx__search-input" />
          </div>
          <div className="fv-xlsx__zoom-group">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="fv-xlsx__zoom-btn" title={t.zoomOut}><ZoomOutIcon size={14} /></button>
            <span className="fv-xlsx__zoom-label">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="fv-xlsx__zoom-btn" title={t.zoomIn}><ZoomInIcon size={14} /></button>
          </div>
          <span className="fv-xlsx__info">
            {mode === "fast" && currentSheet?.totalRows > XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT ? (
              <>
                {XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT.toLocaleString()} / {currentSheet.totalRows.toLocaleString()} {t.largeFileRows} × {currentSheet.totalCols} {t.largeFileCols}
              </>
            ) : (
              <>
                {currentSheet?.totalRows?.toLocaleString() || 0} {t.largeFileRows} × {currentSheet?.totalCols || 0} {t.largeFileCols}
                {currentSheet?.imageCount ? ` · ${currentSheet.imageCount} ${t.largeFileImages}` : ""}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Large file banners */}
      {isLargeFile && mode === "fast" && (
        <div className="fv-xlsx__large-banner fv-xlsx__large-banner--warning">
          {t.largeFileFastModeBanner.replace("{fileSize}", formatFileSize(fileSize)).replace("{rowLimit}", XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT.toLocaleString())}
        </div>
      )}
      {isLargeFile && mode === "fidelity" && (
        <div className="fv-xlsx__large-banner fv-xlsx__large-banner--danger">
          {t.largeFileFidelityBanner}
        </div>
      )}

      {/* Table */}
      <div ref={scrollRef} className="fv-xlsx__content">
        <div style={{ zoom: zoom / 100 }}>
          <table className="fv-xlsx__table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: ROW_NUM_COL_WIDTH }} />
              {allColWidths.map((w, i) => (<col key={i} style={{ width: w }} />))}
            </colgroup>
            <thead>
              <tr>
                <th className="fv-xlsx__col-header" />
                {allColWidths.map((w, i) => (
                  <th key={i} className="fv-xlsx__col-header">
                    {colNumToLetter(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ row, originalIdx }) => {
                if (!row) return null;
                const rh = currentSheet?.rowHeights[originalIdx] || 0;

                // Calculate min height for images in this row
                let imgMinHeight = 0;
                for (const cell of row) {
                  if (cell?.images) {
                    for (const img of cell.images) {
                      const h = img.unsupported ? 40 : (img.naturalHeight || 60);
                      imgMinHeight = Math.max(imgMinHeight, h + 8);
                    }
                  }
                }
                const effectiveHeight = Math.max(rh, imgMinHeight) || undefined;

                return (
                  <tr key={originalIdx} style={effectiveHeight ? { height: effectiveHeight } : undefined}>
                    <td className="fv-xlsx__row-num">
                      {originalIdx + 1}
                    </td>
                    {row.map((cell, colIdx) => {
                      if (!cell) return null;
                      const cs = styleToCss(cell.style);
                      const db = "1px solid #d1d5db";
                      const fs: React.CSSProperties = {
                        ...cs, padding: "1px 4px", overflow: "visible",
                        whiteSpace: cs.whiteSpace || "nowrap", position: "relative",
                        borderTop: cell.style.borderTop || db, borderRight: cell.style.borderRight || db,
                        borderBottom: cell.style.borderBottom || db, borderLeft: cell.style.borderLeft || db,
                      };

                      const hasImages = cell.images && cell.images.length > 0;
                      const hasHyperlink = !!cell.style.hyperlink;
                      const hasComment = !!cell.style.comment;

                      return (
                        <td key={colIdx} style={fs} rowSpan={cell.rowspan || undefined} colSpan={cell.colspan || undefined}>
                          {hasImages ? (
                            <div className="fv-xlsx__cell-images" style={{ minHeight: 30 }}>
                              {cell.images!.map((img, imgIdx) => (
                                img.unsupported ? (
                                  <div key={imgIdx}
                                    className="fv-xlsx__cell-image-placeholder"
                                    style={{ width: 60, height: 40 }}
                                    title={`${t.unsupportedImageFormat}: ${img.formatName || t.unknown}`}
                                  >
                                    <ImageOffIcon size={14} />
                                    <span style={{ fontSize: 8, color: "#9ca3af" }}>{img.formatName}</span>
                                  </div>
                                ) : (
                                  <img key={imgIdx} src={img.dataUrl!} alt=""
                                    style={{
                                      width: img.naturalWidth || "auto",
                                      height: img.naturalHeight || "auto",
                                      maxWidth: "100%",
                                      objectFit: "contain",
                                      display: "block",
                                    }}
                                    loading="lazy"
                                  />
                                )
                              ))}
                              {cell.value?.trim() && (
                                <span className="fv-xlsx__cell-image-label">{cell.value}</span>
                              )}
                            </div>
                          ) : hasHyperlink ? (
                            <a href={cell.style.hyperlink} target="_blank" rel="noopener noreferrer"
                              className="fv-xlsx__cell-link"
                              style={{ fontSize: "inherit", fontFamily: "inherit" }}>
                              {cell.value}
                              <ExternalLinkIcon size={10} />
                            </a>
                          ) : (
                            cell.value
                          )}
                          {hasComment && (
                            <span className="fv-xlsx__comment-dot"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const container = scrollRef.current?.getBoundingClientRect();
                                setHoveredComment({
                                  row: originalIdx, col: colIdx, text: cell.style.comment!,
                                  x: rect.left - (container?.left ?? 0) + rect.width / 2,
                                  y: rect.top - (container?.top ?? 0),
                                });
                              }}
                              onMouseLeave={() => setHoveredComment(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {isTruncated && (
                <tr>
                  <td colSpan={totalCols + 1} className="fv-xlsx__truncation-row fv-xlsx__truncation-row--warning">
                    {t.truncatedRows.replace("{shown}", MAX_RENDER_ROWS.toLocaleString()).replace("{total}", allDisplayRows.length.toLocaleString())}
                  </td>
                </tr>
              )}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={totalCols + 1} className="fv-xlsx__truncation-row fv-xlsx__truncation-row--empty">
                    {searchTerm ? t.noSearchResults : t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comment tooltip */}
      {hoveredComment && (
        <div className="fv-xlsx__comment-tooltip"
          style={{ left: hoveredComment.x, top: hoveredComment.y - 8, transform: "translate(-50%, -100%)" }}>
          <div className="fv-xlsx__comment-tooltip-header">
            <MessageSquareIcon size={10} /> {t.comment}
          </div>
          <p className="fv-xlsx__comment-tooltip-text">{hoveredComment.text}</p>
        </div>
      )}
    </div>
  );
}
