/**
 * Excel preview — color conversion utilities.
 *
 * Moved from XlsxPreview.tsx to enable reuse across table and
 * spreadsheet transform layers.
 */

// ─── Default Theme Colors ───
// Excel cell theme indexes map to:
// 0=lt1, 1=dk1, 2=lt2, 3=dk2, 4..9=accent1..accent6, 10=hlink, 11=folHlink.
// This order differs from the visual order in theme1.xml (`dk1`, `lt1`, `dk2`, `lt2`, ...).
export const DEFAULT_THEME_COLORS: string[] = [
  "#FFFFFF", // 0: lt1
  "#000000", // 1: dk1
  "#E7E6E6", // 2: lt2
  "#44546A", // 3: dk2
  "#4472C4", // 4: accent1
  "#ED7D31", // 5: accent2
  "#A5A5A5", // 6: accent3
  "#FFC000", // 7: accent4
  "#5B9BD5", // 8: accent5
  "#70AD47", // 9: accent6
  "#0563C1", // 10: hlink
  "#954F72", // 11: folHlink
  "#BFBFBF",  // 12
  "#A6A6A6",  // 13
  "#808080",  // 14
  "#595959",  // 15
  "#404040",  // 16
  "#262626",  // 17
];

// ─── Indexed Colors ───
export const INDEXED_COLORS: string[] = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#C0C0C0", "#808080",
  "#9999FF", "#993366", "#FFFFCC", "#CCFFFF", "#660066", "#FF8080", "#0066CC", "#CCCCFF",
  "#000080", "#FF00FF", "#FFFF00", "#00FFFF", "#800080", "#800000", "#008080", "#0000FF",
  "#00CCFF", "#CCFFFF", "#CCFFCC", "#FFFF99", "#99CCFF", "#FF99CC", "#CC99FF", "#FFCC99",
  "#3366FF", "#33CCCC", "#99CC00", "#FFCC00", "#FF9900", "#FF6600", "#666699", "#969696",
  "#003366", "#339966", "#003300", "#333300", "#993300", "#993366", "#333399", "#333333",
];

/**
 * Apply a tint value to a hex color.
 * If tint < 0, darkens (multiply RGB by 1 + tint).
 * If tint > 0, lightens (blend toward white).
 */
export function applyTint(hex: string, tint: number | undefined): string {
  if (!tint) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = (c: number) => tint < 0 ? Math.round(c * (1 + tint)) : Math.round(c + (255 - c) * tint);
  return `#${t(r).toString(16).padStart(2, "0")}${t(g).toString(16).padStart(2, "0")}${t(b).toString(16).padStart(2, "0")}`;
}

/**
 * Resolve an ExcelJS color object to a CSS hex string.
 * Handles argb, theme, indexed, and plain string colors.
 *
 * @param color      The ExcelJS color object to resolve.
 * @param themeColors Optional theme color array from the workbook.
 *                    When provided, uses the workbook's actual theme colors
 *                    parsed from xl/theme/theme1.xml. Falls back to
 *                    DEFAULT_THEME_COLORS when not provided.
 */
export function resolveColor(
  color: any,
  themeColors?: string[],
): string | undefined {
  if (!color) return undefined;
  if (color.argb) {
    const a = color.argb;
    // 00000000 = fully transparent → no visible color
    if (!a || a === "00000000") return undefined;
    // FFFFFFFF = opaque white → resolve to #ffffff (do NOT skip;
    // white fills/fonts are meaningful in Excel styling)
    if (a === "FFFFFFFF") return "#ffffff";
    return a.length === 8 ? "#" + a.slice(2).toLowerCase() : a.toLowerCase();
  }
  if (color.theme !== undefined) {
    const palette = themeColors || DEFAULT_THEME_COLORS;
    return applyTint(palette[color.theme] || "#000000", color.tint);
  }
  if (color.indexed !== undefined && INDEXED_COLORS[color.indexed]) return applyTint(INDEXED_COLORS[color.indexed], color.tint);
  if (typeof color === "string") return color;
  return undefined;
}
