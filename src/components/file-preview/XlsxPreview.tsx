"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// Lazy-load ExcelJS to avoid blocking initial page load
let ExcelJS: typeof import("exceljs") | null = null;
async function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = await import("exceljs");
  }
  return ExcelJS;
}

interface XlsxPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

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
}

interface CellData {
  value: string;
  style: CellStyle;
  colspan?: number;
  rowspan?: number;
  image?: ImageInCell;
}

interface ImageInCell {
  dataUrl: string;
  widthPx?: number;
  heightPx?: number;
}

interface ImageInfo {
  dataUrl: string;
  nativeRow: number;
  nativeCol: number;
  colOffset: number;
  rowOffset: number;
  brNativeRow: number;
  brNativeCol: number;
  widthEmu?: number;
  heightEmu?: number;
}

interface SheetData {
  name: string;
  cellGrid: (CellData | null)[][];
  colWidths: number[];
  rowHeights: number[];
  totalRows: number;
  totalCols: number;
  imageCount: number;
}

// ---- Color Helpers ----
const THEME_COLORS: Record<number, string> = {
  0: "#000000", 1: "#FFFFFF", 2: "#44546A", 3: "#E7E6E6",
  4: "#4472C4", 5: "#ED7D31", 6: "#A5A5A5", 7: "#FFC000",
  8: "#5B9BD5", 9: "#70AD47",
};

function applyTint(hex: string, tint: number | undefined): string {
  if (!tint) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = (c: number) => tint < 0 ? Math.round(c * (1 + tint)) : Math.round(c + (255 - c) * tint);
  return `#${t(r).toString(16).padStart(2,"0")}${t(g).toString(16).padStart(2,"0")}${t(b).toString(16).padStart(2,"0")}`;
}

function resolveColor(color: any): string | undefined {
  if (!color) return undefined;
  if (color.argb) {
    const a = color.argb;
    if (!a || a === "00000000" || a === "FFFFFFFF") return undefined;
    return a.length === 8 ? "#" + a.slice(2).toLowerCase() : a.toLowerCase();
  }
  if (color.theme !== undefined) return applyTint(THEME_COLORS[color.theme] || "#000000", color.tint);
  if (typeof color === "string") return color;
  return undefined;
}

function borderCss(part: any): string {
  if (!part?.style || part.style === "none") return "";
  const w = part.style === "thin" ? "1px" : part.style === "medium" ? "2px" :
    part.style === "thick" ? "3px" : part.style === "hair" ? "0.5px" :
    part.style === "double" ? "3px" : part.style.startsWith("medium") ? "2px" : "1px";
  const c = resolveColor(part.color) || "#000000";
  const s = /dashed|dotted/.test(part.style) ? "dashed" : "solid";
  return `${w} ${s} ${c}`;
}

// ---- Cell Value Formatting ----
function formatCellValue(cell: any): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Error) return v.message || "#ERROR";
  if (typeof v === "object" && "richText" in v) return v.richText.map((r: any) => r.text).join("");
  if (typeof v === "object" && "formula" in v) {
    const r = v.result;
    return r !== null && r !== undefined ? String(r) : "";
  }
  if (typeof v === "object" && "hyperlink" in v) return v.text || v.hyperlink;
  if (v instanceof Date) {
    const fmt = cell.numFmt;
    if (fmt && /[yYmdhHs]/.test(fmt)) {
      try {
        const d = v, pad = (n: number) => n.toString().padStart(2, "0");
        let res = fmt;
        res = res.replace(/yyyy/g, d.getFullYear().toString());
        res = res.replace(/yy/g, d.getFullYear().toString().slice(-2));
        const parts = res.split(/hh/i);
        parts[0] = parts[0].replace(/mm/g, pad(d.getMonth() + 1));
        if (parts.length > 1) parts[1] = parts[1].replace(/mm/g, pad(d.getMinutes()));
        res = parts.join("hh");
        res = res.replace(/dd/g, pad(d.getDate()));
        res = res.replace(/hh/gi, pad(d.getHours()));
        res = res.replace(/ss/g, pad(d.getSeconds()));
        return res.replace(/[\\]/g, "");
      } catch { return v.toLocaleDateString("zh-CN"); }
    }
    return v.toLocaleDateString("zh-CN");
  }
  if (typeof v === "number") {
    const fmt = cell.numFmt;
    if (fmt) {
      if (fmt.includes("%")) {
        const z = (fmt.match(/0/g) || []).length;
        return (v * 100).toFixed(Math.max(0, z - 1)) + "%";
      }
      if (fmt.includes("#,##0") || fmt.includes("# ##0")) {
        const dp = fmt.split(".")[1];
        const dec = dp ? (dp.match(/0/g) || []).length : 0;
        let f = v.toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
        if (fmt.includes("¥")) f = "¥" + f;
        else if (fmt.includes("$")) f = "$" + f;
        else if (fmt.includes("€")) f = "€" + f;
        return f;
      }
      if (fmt.includes("0.0") || fmt.includes("0.00")) {
        const dec = fmt.split(".")[1]?.replace(/[^0]/g, "").length || 0;
        return v.toFixed(dec);
      }
    }
    return v.toString();
  }
  return String(v);
}

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

// EMU (English Metric Units) to pixels: 1 EMU = 1/914400 inch, 96 DPI => 1px = 914400/96 EMU = 9525 EMU
function emuToPx(emu: number): number {
  return Math.round(emu / 9525);
}

// ---- Main Parser ----
async function parseXlsx(base64Content: string): Promise<SheetData[]> {
  const EJS = await getExcelJS();

  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const workbook = new EJS.Workbook();
  await workbook.xlsx.load(bytes);

  const sheets: SheetData[] = [];

  workbook.eachSheet((worksheet: any) => {
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;

    if (rowCount === 0 || colCount === 0) {
      sheets.push({ name: worksheet.name, cellGrid: [], colWidths: [], rowHeights: [], totalRows: 0, totalCols: 0, imageCount: 0 });
      return;
    }

    // Column widths (chars -> pixels)
    const colWidths: number[] = [];
    for (let c = 1; c <= colCount; c++) {
      const col = worksheet.getColumn(c);
      colWidths.push(col.width ? Math.round(Math.max(col.width * 7.5, 50)) : 80);
    }

    // Row heights
    const rowHeights: number[] = [];
    for (let r = 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      rowHeights.push(row.height ? Math.round(row.height) : 0);
    }

    // ---- Merge ranges (using _merges for reliable parsing) ----
    const merges: Map<string, { rs: number; cs: number }> = new Map();
    const mergedCells = new Set<string>();

    const _merges = (worksheet as any)._merges;
    if (_merges) {
      for (const [, merge] of Object.entries(_merges) as [string, any][]) {
        const m = merge?.model || merge;
        if (m?.top != null && m?.left != null) {
          const key = `${m.top - 1}-${m.left - 1}`;
          merges.set(key, { rs: m.bottom - m.top + 1, cs: m.right - m.left + 1 });
          for (let r = m.top; r <= m.bottom; r++) {
            for (let c = m.left; c <= m.right; c++) {
              if (r !== m.top || c !== m.left) mergedCells.add(`${r - 1}-${c - 1}`);
            }
          }
        }
      }
    }
    // Fallback: model.merges (string format like "A1:F1")
    const modelMerges = (worksheet as any).model?.merges;
    if (modelMerges && modelMerges.length > 0 && typeof modelMerges[0] === "string") {
      const colLetterToNum = (s: string) => {
        let n = 0;
        for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
        return n;
      };
      for (const rangeStr of modelMerges) {
        const match = (rangeStr as string).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (match) {
          const top = parseInt(match[2]), left = colLetterToNum(match[1]);
          const bottom = parseInt(match[4]), right = colLetterToNum(match[3]);
          const key = `${top - 1}-${left - 1}`;
          if (!merges.has(key)) {
            merges.set(key, { rs: bottom - top + 1, cs: right - left + 1 });
            for (let r = top; r <= bottom; r++) {
              for (let c = left; c <= right; c++) {
                if (r !== top || c !== left) mergedCells.add(`${r - 1}-${c - 1}`);
              }
            }
          }
        }
      }
    }

    // ---- Extract images ----
    const images: ImageInfo[] = [];
    try {
      const wsImages = worksheet.getImages();
      for (const img of wsImages) {
        const imageId = parseInt(img.imageId, 10);
        if (isNaN(imageId)) continue;
        const imageData = workbook.getImage(imageId);
        if (!imageData?.buffer) continue;

        const ext = imageData.extension || "png";
        const mimeType = ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/png";

        // Convert buffer to base64
        let base64: string;
        const buf = imageData.buffer;
        if (buf instanceof Uint8Array || buf instanceof ArrayBuffer) {
          const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < arr.length; i += 8192) {
            const chunk = arr.subarray(i, Math.min(i + 8192, arr.length));
            bin += String.fromCharCode(...chunk);
          }
          base64 = btoa(bin);
        } else if (typeof buf === "string") {
          base64 = buf;
        } else {
          // Node.js Buffer polyfill - has .toString('base64')
          base64 = (buf as any).toString("base64");
        }

        const range = img.range;
        if (!range?.tl) continue;

        const tl = range.tl;
        const br = range.br;

        images.push({
          dataUrl: `data:${mimeType};base64,${base64}`,
          nativeRow: tl.nativeRow ?? 0,
          nativeCol: tl.nativeCol ?? 0,
          colOffset: tl.nativeColOff ?? 0,
          rowOffset: tl.nativeRowOff ?? 0,
          brNativeRow: br?.nativeRow ?? (tl.nativeRow ?? 0) + 3,
          brNativeCol: br?.nativeCol ?? (tl.nativeCol ?? 0) + 1,
          widthEmu: range.ext?.width,
          heightEmu: range.ext?.height,
        });
      }
    } catch (err) {
      console.warn("Image extraction error:", err);
    }

    // ---- Group images by their anchor row for overlay rendering ----
    // Images in Excel float over cells, so we render them as overlays on the table
    // We need to calculate pixel positions from nativeRow + offsets

    // Calculate cumulative column widths and row heights for pixel positioning
    const colPx = [0]; // cumulative left position for each column (0-based)
    for (let c = 0; c < colCount; c++) colPx.push(colPx[c] + colWidths[c]);

    const rowPx = [0]; // cumulative top position for each row (0-based)
    for (let r = 0; r < rowCount; r++) {
      rowPx.push(rowPx[r] + (rowHeights[r] || DEFAULT_ROW_HEIGHT));
    }

    // Build image overlay data with pixel positions
    const imageOverlays: Array<{
      dataUrl: string;
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];

    for (const img of images) {
      const r = img.nativeRow;
      const c = img.nativeCol;
      if (r >= rowCount || c >= colCount) continue;

      // Position: row/col start + EMU offset
      const left = colPx[c] + emuToPx(img.colOffset) + ROW_NUM_COL_WIDTH;
      const top = rowPx[r] + emuToPx(img.rowOffset) + HEADER_ROW_HEIGHT;

      // Size: from tl to br, or from ext
      let width: number, height: number;
      if (img.widthEmu && img.heightEmu) {
        width = emuToPx(img.widthEmu);
        height = emuToPx(img.heightEmu);
      } else {
        // Calculate from tl/br positions
        const brLeft = img.brNativeCol < colCount
          ? colPx[img.brNativeCol] + emuToPx(img.brNativeColOff ?? 0)
          : colPx[colCount];
        const brTop = img.brNativeRow < rowCount
          ? rowPx[img.brNativeRow] + emuToPx(img.brNativeRowOff ?? 0)
          : rowPx[rowCount];
        width = Math.max(20, brLeft - (colPx[c] + emuToPx(img.colOffset)));
        height = Math.max(20, brTop - (rowPx[r] + emuToPx(img.rowOffset)));
      }

      imageOverlays.push({ dataUrl: img.dataUrl, left, top, width: Math.max(20, width), height: Math.max(20, height) });
    }

    // ---- Build cell grid ----
    const cellGrid: (CellData | null)[][] = [];

    for (let r = 0; r < rowCount; r++) {
      const row: (CellData | null)[] = [];
      const excelRow = worksheet.getRow(r + 1);

      for (let c = 0; c < colCount; c++) {
        const key = `${r}-${c}`;
        if (mergedCells.has(key)) { row.push(null); continue; }

        const cell = excelRow.getCell(c + 1);
        const value = formatCellValue(cell);
        const style = extractStyle(cell);
        const merge = merges.get(key);

        row.push({ value, style, colspan: merge?.cs, rowspan: merge?.rs });
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
      imageCount: images.length,
      imageOverlays,
    } as SheetData & { imageOverlays: typeof imageOverlays });
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

const ROW_NUM_COL_WIDTH = 45;
const HEADER_ROW_HEIGHT = 22;
const DEFAULT_ROW_HEIGHT = 22;

export function XlsxPreview({ content, fileName }: XlsxPreviewProps) {
  const [sheets, setSheets] = useState<(SheetData & { imageOverlays?: any[] })[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 60 });

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parseXlsx(content);
      setSheets(result as any);
    } catch (err) {
      console.error("XLSX parse error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => { parseFile(); }, [parseFile]);

  // Virtual scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scale = zoom / 100;
    const approxRowH = DEFAULT_ROW_HEIGHT * scale;
    const start = Math.max(0, Math.floor(el.scrollTop / approxRowH) - 15);
    const end = Math.min(sheets[activeSheet]?.totalRows || 0, Math.ceil((el.scrollTop + el.clientHeight) / approxRowH) + 25);
    setVisibleRange({ start, end });
  }, [zoom, activeSheet, sheets]);

  useEffect(() => {
    setVisibleRange({ start: 0, end: 60 });
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeSheet]);

  const currentSheet = sheets[activeSheet];

  const filteredRowIndices = useMemo(() => {
    if (!currentSheet || !searchTerm) return null;
    const indices: number[] = [];
    const term = searchTerm.toLowerCase();
    currentSheet.cellGrid.forEach((row, idx) => {
      if (row.some((cell) => cell && cell.value.toLowerCase().includes(term))) indices.push(idx);
    });
    return indices;
  }, [currentSheet, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">正在解析表格...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <p className="text-lg font-medium">解析失败</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (sheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
        <p className="text-lg font-medium">未找到工作表</p>
      </div>
    );
  }

  const rows = currentSheet?.cellGrid || [];
  const isSearch = !!filteredRowIndices;
  const displayRows = isSearch
    ? filteredRowIndices!.map((idx) => ({ row: rows[idx], originalIdx: idx }))
    : rows.map((row, idx) => ({ row, originalIdx: idx }));

  const renderedRows = isSearch
    ? displayRows
    : displayRows.filter(({ originalIdx }) => originalIdx >= visibleRange.start && originalIdx < visibleRange.end);

  const vPadTop = isSearch ? 0 : visibleRange.start * DEFAULT_ROW_HEIGHT;
  const vPadBottom = isSearch ? 0 : Math.max(0, (currentSheet?.totalRows || 0) - visibleRange.end) * DEFAULT_ROW_HEIGHT;

  // Calculate total table width for image overlay container
  const totalTableWidth = (currentSheet?.colWidths || []).reduce((a, b) => a + b, 0) + ROW_NUM_COL_WIDTH;
  const totalTableHeight = (currentSheet?.rowHeights || []).reduce((a, b) => a + (b || DEFAULT_ROW_HEIGHT), 0) + HEADER_ROW_HEIGHT;

  const imageOverlays = (currentSheet as any)?.imageOverlays || [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Table2 size={14} className="text-muted-foreground" />
          {sheets.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {sheets.map((sheet, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveSheet(i); setSearchTerm(""); }}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    i === activeSheet ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-36 pl-8 pr-3 py-1 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-0.5 border rounded-md px-1">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 hover:bg-muted rounded transition-colors" title="缩小">
              <ZoomOut size={14} className="text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center select-none">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 hover:bg-muted rounded transition-colors" title="放大">
              <ZoomIn size={14} className="text-muted-foreground" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground select-none">
            {currentSheet?.totalRows || 0} 行 × {currentSheet?.totalCols || 0} 列
            {currentSheet?.imageCount ? ` · ${currentSheet.imageCount} 张图片` : ""}
          </span>
        </div>
      </div>

      {/* Table with image overlay */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-gray-100" onScroll={handleScroll}>
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
          {/* Container for table + image overlays */}
          <div className="relative" style={{ width: totalTableWidth, minHeight: totalTableHeight }}>
            {/* Image overlay layer - positioned absolutely over the table */}
            {imageOverlays.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-[5]" style={{ top: 0, left: 0 }}>
                {imageOverlays.map((img: any, idx: number) => (
                  <img
                    key={idx}
                    src={img.dataUrl}
                    alt=""
                    className="pointer-events-auto"
                    style={{
                      position: "absolute",
                      left: img.left,
                      top: img.top,
                      width: img.width,
                      height: img.height,
                      objectFit: "contain",
                    }}
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {/* Table */}
            <table className="border-collapse bg-white" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th
                    className="bg-gray-50 border-b border-r border-gray-300 text-center text-[11px] text-gray-400 font-normal select-none sticky top-0 z-20"
                    style={{ width: ROW_NUM_COL_WIDTH, minWidth: ROW_NUM_COL_WIDTH }}
                  />
                  {currentSheet?.colWidths.map((w, i) => (
                    <th
                      key={i}
                      className="bg-gray-50 border-b border-r border-gray-300 text-center text-[11px] text-gray-400 font-normal select-none sticky top-0 z-20"
                      style={{ width: w, minWidth: w }}
                    >
                      {colNumToLetter(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vPadTop > 0 && (
                  <tr><td colSpan={(currentSheet?.totalCols || 0) + 1} style={{ height: vPadTop, padding: 0, border: "none" }} /></tr>
                )}
                {renderedRows.map(({ row, originalIdx }) => {
                  if (!row) return null;
                  const rh = currentSheet?.rowHeights[originalIdx] || 0;
                  return (
                    <tr key={originalIdx} style={rh ? { height: rh } : undefined}>
                      <td className="bg-gray-50 border-b border-r border-gray-300 text-center text-[11px] text-gray-400 font-mono select-none sticky left-0 z-10">
                        {originalIdx + 1}
                      </td>
                      {row.map((cell, colIdx) => {
                        if (!cell) return null;
                        const cs = styleToCss(cell.style);
                        const db = "1px solid #d1d5db";
                        const fs: React.CSSProperties = {
                          ...cs, padding: "1px 4px", overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: cs.whiteSpace || "nowrap", position: "relative",
                          borderTop: cell.style.borderTop || db, borderRight: cell.style.borderRight || db,
                          borderBottom: cell.style.borderBottom || db, borderLeft: cell.style.borderLeft || db,
                          ...(rh ? { height: rh } : {}),
                        };
                        return (
                          <td key={colIdx} style={fs} rowSpan={cell.rowspan || undefined} colSpan={cell.colspan || undefined}>
                            {cell.value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={(currentSheet?.totalCols || 0) + 1} className="px-3 py-8 text-center text-muted-foreground bg-white border border-gray-300">
                      {searchTerm ? "未找到匹配数据" : "无数据"}
                    </td>
                  </tr>
                )}
                {vPadBottom > 0 && (
                  <tr><td colSpan={(currentSheet?.totalCols || 0) + 1} style={{ height: vPadBottom, padding: 0, border: "none" }} /></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
