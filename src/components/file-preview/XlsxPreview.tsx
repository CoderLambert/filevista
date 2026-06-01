"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import {
  Search,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

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
}

interface SheetData {
  name: string;
  cellGrid: (CellData | null)[][];
  colWidths: number[];
  rowHeights: number[];
  totalRows: number;
  totalCols: number;
}

// ---- Color Helpers ----
function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb === "00000000" || argb === "FFFFFFFF") return undefined;
  if (argb.length === 8) return "#" + argb.slice(2).toLowerCase();
  if (argb.startsWith("#")) return argb.toLowerCase();
  return undefined;
}

const THEME_COLORS: Record<number, string> = {
  0: "#000000",
  1: "#FFFFFF",
  2: "#44546A",
  3: "#E7E6E6",
  4: "#4472C4",
  5: "#ED7D31",
  6: "#A5A5A5",
  7: "#FFC000",
  8: "#5B9BD5",
  9: "#70AD47",
};

function applyTint(hexColor: string, tint: number | undefined): string {
  if (tint === undefined || tint === 0) return hexColor;
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const tinted = (c: number) =>
    tint < 0 ? Math.round(c * (1 + tint)) : Math.round(c + (255 - c) * tint);
  return `#${tinted(r).toString(16).padStart(2, "0")}${tinted(g).toString(16).padStart(2, "0")}${tinted(b).toString(16).padStart(2, "0")}`;
}

function resolveColor(color: ExcelJS.Font["color"]): string | undefined {
  if (!color) return undefined;
  if (color.argb) return argbToHex(color.argb);
  if (color.theme !== undefined)
    return applyTint(THEME_COLORS[color.theme] || "#000000", color.tint);
  if (typeof color === "string") return color;
  return undefined;
}

function resolveBorderColor(borderPart: ExcelJS.Border): string | undefined {
  if (!borderPart || !borderPart.style || borderPart.style === "none") return undefined;
  return resolveColor(borderPart.color);
}

function borderCss(part: ExcelJS.Border | undefined): string {
  if (!part || !part.style || part.style === "none") return "";
  const width =
    part.style === "thin" ? "1px" :
    part.style === "medium" ? "2px" :
    part.style === "thick" ? "3px" :
    part.style === "hair" ? "0.5px" :
    part.style === "double" ? "3px" :
    part.style.startsWith("medium") ? "2px" :
    "1px";
  const color = resolveBorderColor(part) || "#000000";
  const style = part.style === "dashed" || part.style === "mediumDashed" || part.style === "dotted"
    ? "dashed" : "solid";
  return `${width} ${style} ${color}`;
}

// ---- Cell Value Formatting ----
function formatCellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Error) return v.message || "#ERROR";

  // Rich text
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }

  // Formula
  if (typeof v === "object" && "formula" in v) {
    const result = (v as ExcelJS.CellFormulaValue).result;
    return result !== null && result !== undefined ? String(result) : "";
  }

  // Hyperlink
  if (typeof v === "object" && "hyperlink" in v) {
    return (v as ExcelJS.CellHyperlinkValue).text || (v as ExcelJS.CellHyperlinkValue).hyperlink;
  }

  // Date
  if (v instanceof Date) {
    const fmt = cell.numFmt;
    if (fmt && /[yYmdhHs]/.test(fmt)) {
      try {
        const d = v;
        const pad = (n: number) => n.toString().padStart(2, "0");
        let result = fmt;
        result = result.replace(/yyyy/g, d.getFullYear().toString());
        result = result.replace(/yy/g, d.getFullYear().toString().slice(-2));
        // Handle month (mm) and minutes - context dependent
        // First replace date-related mm, then time-related mm
        const parts = result.split(/hh/i);
        parts[0] = parts[0].replace(/mm/g, pad(d.getMonth() + 1));
        if (parts.length > 1) {
          parts[1] = parts[1].replace(/mm/g, pad(d.getMinutes()));
        }
        result = parts.join("hh");
        result = result.replace(/dd/g, pad(d.getDate()));
        result = result.replace(/hh/gi, pad(d.getHours()));
        result = result.replace(/ss/g, pad(d.getSeconds()));
        // Remove format characters that are not replaced
        result = result.replace(/[\\]/g, "");
        return result;
      } catch {
        return v.toLocaleDateString("zh-CN");
      }
    }
    return v.toLocaleDateString("zh-CN");
  }

  // Number formatting
  if (typeof v === "number") {
    const fmt = cell.numFmt;
    if (fmt) {
      // Percentage
      if (fmt.includes("%")) {
        const zeros = (fmt.match(/0/g) || []).length;
        const decimals = Math.max(0, zeros - 1);
        return (v * 100).toFixed(decimals) + "%";
      }
      // Currency / thousands separator
      if (fmt.includes("#,##0") || fmt.includes("# ##0")) {
        const dotPart = fmt.split(".")[1];
        const decimals = dotPart ? (dotPart.match(/0/g) || []).length : 0;
        let formatted = v.toLocaleString("zh-CN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        if (fmt.includes("¥")) formatted = "¥" + formatted;
        else if (fmt.includes("$")) formatted = "$" + formatted;
        else if (fmt.includes("€")) formatted = "€" + formatted;
        return formatted;
      }
      // Fixed decimal
      if (fmt.includes("0.0") || fmt.includes("0.00")) {
        const decimals = fmt.split(".")[1]?.replace(/[^0]/g, "").length || 0;
        return v.toFixed(decimals);
      }
    }
    // Show integers without decimals, floats with reasonable precision
    if (Number.isInteger(v)) return v.toString();
    return v.toString();
  }

  return String(v);
}

// ---- Style Extraction ----
function extractStyle(cell: ExcelJS.Cell): CellStyle {
  const s: CellStyle = {};

  // Font
  const f = cell.font;
  if (f) {
    if (f.name) s.fontFamily = f.name;
    if (f.size) s.fontSize = f.size;
    if (f.bold) s.bold = true;
    if (f.italic) s.italic = true;
    if (f.underline) s.underline = true;
    const fc = resolveColor(f.color);
    if (fc) s.fontColor = fc;
  }

  // Fill (background)
  const fill = cell.fill;
  if (fill && fill.pattern && fill.pattern !== "none") {
    const fgColor = resolveColor(fill.fgColor as any);
    const bgColor = resolveColor(fill.bgColor as any);
    s.bgColor = fgColor || bgColor;
  }

  // Alignment
  const a = cell.alignment;
  if (a) {
    if (a.horizontal && a.horizontal !== "fill") s.hAlign = a.horizontal;
    if (a.vertical) s.vAlign = a.vertical;
    if (a.wrapText) s.wrapText = true;
    if (a.textRotation) s.textRotation = a.textRotation;
  }

  // Borders
  const b = cell.border;
  if (b) {
    if (b.top) s.borderTop = borderCss(b.top);
    if (b.right) s.borderRight = borderCss(b.right);
    if (b.bottom) s.borderBottom = borderCss(b.bottom);
    if (b.left) s.borderLeft = borderCss(b.left);
  }

  // Number format
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

  if (style.bgColor && style.bgColor !== "#ffffff" && style.bgColor !== "#FFFFFF") {
    css.backgroundColor = style.bgColor;
  }

  if (style.hAlign) {
    css.textAlign = style.hAlign as React.CSSProperties["textAlign"];
  }
  if (style.vAlign) {
    css.verticalAlign = style.vAlign === "middle" ? "middle" : style.vAlign as React.CSSProperties["verticalAlign"];
  }
  if (style.wrapText) css.whiteSpace = "pre-wrap";
  if (style.textRotation) {
    if (style.textRotation === 255) {
      css.writingMode = "vertical-rl";
    } else {
      css.transform = `rotate(-${style.textRotation}deg)`;
    }
  }

  return css;
}

// ---- Main Parser ----
async function parseXlsx(base64Content: string): Promise<SheetData[]> {
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);

  const sheets: SheetData[] = [];

  workbook.eachSheet((worksheet) => {
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;

    if (rowCount === 0 || colCount === 0) {
      sheets.push({
        name: worksheet.name,
        cellGrid: [],
        colWidths: [],
        rowHeights: [],
        totalRows: 0,
        totalCols: 0,
      });
      return;
    }

    // Column widths (ExcelJS char units -> pixels, ~7.5px per char)
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

    // Merge ranges
    const merges: Map<string, { rs: number; cs: number }> = new Map();
    const mergedCells = new Set<string>();

    try {
      const model = (worksheet as any).model;
      if (model?.merges) {
        for (const m of model.merges) {
          const key = `${m.top - 1}-${m.left - 1}`;
          merges.set(key, { rs: m.bottom - m.top + 1, cs: m.right - m.left + 1 });
          for (let r = m.top; r <= m.bottom; r++) {
            for (let c = m.left; c <= m.right; c++) {
              if (r !== m.top || c !== m.left) {
                mergedCells.add(`${r - 1}-${c - 1}`);
              }
            }
          }
        }
      }
    } catch {
      // Fallback: try _merges
      try {
        const _merges = (worksheet as any)._merges;
        if (_merges) {
          for (const [, merge] of Object.entries(_merges)) {
            const m = (merge as any).model;
            if (m) {
              const key = `${m.top - 1}-${m.left - 1}`;
              merges.set(key, { rs: m.bottom - m.top + 1, cs: m.right - m.left + 1 });
              for (let r = m.top; r <= m.bottom; r++) {
                for (let c = m.left; c <= m.right; c++) {
                  if (r !== m.top || c !== m.left) {
                    mergedCells.add(`${r - 1}-${c - 1}`);
                  }
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Build cell grid
    const cellGrid: (CellData | null)[][] = [];

    for (let r = 0; r < rowCount; r++) {
      const row: (CellData | null)[] = [];
      const excelRow = worksheet.getRow(r + 1);

      for (let c = 0; c < colCount; c++) {
        const key = `${r}-${c}`;

        // Cell is merged but not the origin -> null
        if (mergedCells.has(key)) {
          row.push(null);
          continue;
        }

        const cell = excelRow.getCell(c + 1);
        const value = formatCellValue(cell);
        const style = extractStyle(cell);
        const merge = merges.get(key);

        row.push({
          value,
          style,
          colspan: merge?.cs,
          rowspan: merge?.rs,
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

export function XlsxPreview({ content, fileName }: XlsxPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(100);

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parseXlsx(content);
      setSheets(result);
    } catch (err) {
      console.error("Error parsing XLSX:", err);
      setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => {
    parseFile();
  }, [parseFile]);

  const currentSheet = sheets[activeSheet];

  // Filter rows by search
  const filteredRowIndices = useMemo(() => {
    if (!currentSheet || !searchTerm) return null;
    const indices: number[] = [];
    const term = searchTerm.toLowerCase();
    currentSheet.cellGrid.forEach((row, idx) => {
      if (row.some((cell) => cell && cell.value.toLowerCase().includes(term))) {
        indices.push(idx);
      }
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
  const displayRows = filteredRowIndices
    ? filteredRowIndices.map((idx) => ({ row: rows[idx], originalIdx: idx }))
    : rows.map((row, idx) => ({ row, originalIdx: idx }));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Table2 size={14} className="text-muted-foreground" />
          {sheets.length > 1 && (
            <div className="flex gap-1">
              {sheets.map((sheet, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveSheet(i);
                    setSearchTerm("");
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    i === activeSheet
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
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
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-36 pl-8 pr-3 py-1 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-0.5 border rounded-md px-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="缩小"
            >
              <ZoomOut size={14} className="text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center select-none">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="放大"
            >
              <ZoomIn size={14} className="text-muted-foreground" />
            </button>
          </div>

          <span className="text-xs text-muted-foreground select-none">
            {currentSheet?.totalRows || 0} 行 × {currentSheet?.totalCols || 0} 列
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
          }}
        >
          <table
            className="border-collapse bg-white"
            style={{ tableLayout: "fixed" }}
          >
            {/* Column headers */}
            <thead>
              <tr>
                <th
                  className="bg-gray-50 border-b border-r border-gray-300 text-center text-[11px] text-gray-400 font-normal select-none sticky top-0 z-20 bg-gray-50"
                  style={{ width: 45, minWidth: 45 }}
                >
                  {/* Row number header */}
                </th>
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
              {displayRows.map(({ row, originalIdx }) => {
                if (!row) return null;
                const rowHeight = currentSheet?.rowHeights[originalIdx] || 0;

                return (
                  <tr key={originalIdx} style={rowHeight ? { height: rowHeight } : undefined}>
                    {/* Row number */}
                    <td
                      className="bg-gray-50 border-b border-r border-gray-300 text-center text-[11px] text-gray-400 font-mono select-none sticky left-0 z-10"
                    >
                      {originalIdx + 1}
                    </td>
                    {row.map((cell, colIdx) => {
                      if (!cell) return null;

                      const cellCss = styleToCss(cell.style);

                      // Build border style
                      const borderParts: string[] = [];
                      if (cell.style.borderTop) borderParts.push(`border-top: ${cell.style.borderTop}`);
                      if (cell.style.borderRight) borderParts.push(`border-right: ${cell.style.borderRight}`);
                      if (cell.style.borderBottom) borderParts.push(`border-bottom: ${cell.style.borderBottom}`);
                      if (cell.style.borderLeft) borderParts.push(`border-left: ${cell.style.borderLeft}`);

                      // Default thin border if no border is specified
                      const hasAnyBorder = borderParts.length > 0;
                      const defaultBorder = "1px solid #d1d5db";

                      const finalStyle: React.CSSProperties = {
                        ...cellCss,
                        padding: "1px 4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: cellCss.whiteSpace || "nowrap",
                        borderTop: cell.style.borderTop || defaultBorder,
                        borderRight: cell.style.borderRight || defaultBorder,
                        borderBottom: cell.style.borderBottom || defaultBorder,
                        borderLeft: cell.style.borderLeft || defaultBorder,
                        ...(rowHeight ? { height: rowHeight } : {}),
                      };

                      return (
                        <td
                          key={colIdx}
                          style={finalStyle}
                          rowSpan={cell.rowspan || undefined}
                          colSpan={cell.colspan || undefined}
                        >
                          {cell.value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {displayRows.length === 0 && (
                <tr>
                  <td
                    colSpan={(currentSheet?.totalCols || 0) + 1}
                    className="px-3 py-8 text-center text-muted-foreground bg-white border border-gray-300"
                  >
                    {searchTerm ? "未找到匹配数据" : "无数据"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
