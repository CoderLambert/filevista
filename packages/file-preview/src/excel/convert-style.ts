/**
 * Excel preview — style extraction and conversion utilities.
 *
 * Moved from XlsxPreview.tsx to enable reuse across table and
 * spreadsheet transform layers.
 */

import type React from "react";
import { resolveColor } from "./convert-color";
import type { CellStyle } from "./types";

/**
 * Convert an ExcelJS border part to a CSS border string.
 */
export function borderCss(part: any, themeColors?: string[]): string {
  if (!part?.style || part.style === "none") return "";
  const w = part.style === "thin" ? "1px" : part.style === "medium" ? "2px" :
    part.style === "thick" ? "3px" : part.style === "hair" ? "0.5px" :
    part.style === "double" ? "3px" : part.style.startsWith("medium") ? "2px" : "1px";
  const c = resolveColor(part.color, themeColors) || "#000000";
  const s = /dashed|dotted|dashDot/.test(part.style) ? "dashed" : "solid";
  return `${w} ${s} ${c}`;
}

/**
 * Extract a CellStyle from an ExcelJS cell object.
 * Used by the table renderer transform.
 */
export function extractStyle(cell: any, themeColors?: string[]): CellStyle {
  const s: CellStyle = {};
  const f = cell.font;
  if (f) {
    if (f.name) s.fontFamily = f.name;
    if (f.size) s.fontSize = f.size;
    if (f.bold) s.bold = true;
    if (f.italic) s.italic = true;
    if (f.underline) s.underline = true;
    const fc = resolveColor(f.color, themeColors); if (fc) s.fontColor = fc;
  }
  const fill = cell.fill;
  if (fill?.pattern && fill.pattern !== "none") {
    const fg = resolveColor(fill.fgColor, themeColors), bg = resolveColor(fill.bgColor, themeColors);
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
    if (b.top) s.borderTop = borderCss(b.top, themeColors);
    if (b.right) s.borderRight = borderCss(b.right, themeColors);
    if (b.bottom) s.borderBottom = borderCss(b.bottom, themeColors);
    if (b.left) s.borderLeft = borderCss(b.left, themeColors);
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

/**
 * Convert a CellStyle to React CSSProperties for the table renderer.
 */
export function styleToCss(style: CellStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.fontFamily) css.fontFamily = `"${style.fontFamily}", sans-serif`;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.bold) css.fontWeight = "bold";
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.fontColor) css.color = style.fontColor;
  if (style.bgColor) css.backgroundColor = style.bgColor;
  if (style.hAlign) css.textAlign = style.hAlign as any;
  if (style.vAlign) css.verticalAlign = style.vAlign === "middle" ? "middle" : style.vAlign as any;
  if (style.wrapText) css.whiteSpace = "pre-wrap";
  if (style.textRotation) {
    css[style.textRotation === 255 ? "writingMode" : "transform"] =
      style.textRotation === 255 ? "vertical-rl" as any : `rotate(-${style.textRotation}deg)`;
  }
  return css;
}
