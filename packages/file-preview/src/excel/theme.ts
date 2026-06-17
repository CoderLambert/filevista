/**
 * Excel preview — workbook theme color extraction.
 *
 * Parses xl/theme/theme1.xml from the workbook ZIP to extract
 * the actual theme color scheme, replacing the hardcoded default
 * Office palette. This is critical for accurate color rendering
 * because many workbooks use custom themes.
 *
 * ExcelJS does not expose theme colors, so we parse them ourselves.
 */

import JSZip from "jszip";

/**
 * The 12 standard theme color slots in OOXML order.
 * Index 0..11 maps to ExcelJS cell color `theme` property.
 *
 * OOXML spec: theme indices in cell colors use this order:
 * 0=lt1, 1=dk1, 2=lt2, 3=dk2, 4..9=accent1..accent6, 10=hlink, 11=folHlink
 */
export interface WorkbookThemeColors {
  /** theme[0] = lt1 (light 1, typically white) */
  lt1: string;
  /** theme[1] = dk1 (dark 1, typically black) */
  dk1: string;
  /** theme[2] = lt2 (light 2) */
  lt2: string;
  /** theme[3] = dk2 (dark 2) */
  dk2: string;
  /** theme[4..9] = accent1..accent6 */
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  /** theme[10] = hyperlink */
  hlink: string;
  /** theme[11] = followed hyperlink */
  folHlink: string;
}

/** Convert WorkbookThemeColors to the indexed array used by resolveColor. */
export function themeColorsToArray(theme: WorkbookThemeColors): string[] {
  return [
    theme.lt1,   // 0
    theme.dk1,   // 1
    theme.lt2,   // 2
    theme.dk2,   // 3
    theme.accent1, // 4
    theme.accent2, // 5
    theme.accent3, // 6
    theme.accent4, // 7
    theme.accent5, // 8
    theme.accent6, // 9
    theme.hlink,   // 10
    theme.folHlink, // 11
  ];
}

// Default Office theme (used when theme1.xml is missing or unparseable)
export const DEFAULT_THEME: WorkbookThemeColors = {
  lt1: "#FFFFFF",
  dk1: "#000000",
  lt2: "#E7E6E6",
  dk2: "#44546A",
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  accent4: "#FFC000",
  accent5: "#5B9BD5",
  accent6: "#70AD47",
  hlink: "#0563C1",
  folHlink: "#954F72",
};

/**
 * Extract theme colors from a workbook's ArrayBuffer.
 *
 * The workbook is an OOXML ZIP package. We look for xl/theme/theme1.xml
 * and parse the <a:clrScheme> element to get the actual colors.
 *
 * Returns DEFAULT_THEME if the theme cannot be parsed.
 */
export async function extractWorkbookTheme(
  workbookBuffer: ArrayBuffer,
): Promise<WorkbookThemeColors> {
  try {
    const zip = await JSZip.loadAsync(workbookBuffer);
    const themeFile = zip.file("xl/theme/theme1.xml");
    if (!themeFile) return DEFAULT_THEME;

    const xml = await themeFile.async("string");
    return parseThemeXml(xml);
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Parse theme1.xml and extract the color scheme.
 */
function parseThemeXml(xml: string): WorkbookThemeColors {
  // Find <a:clrScheme> block
  const schemeMatch = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  if (!schemeMatch) return DEFAULT_THEME;

  const block = schemeMatch[1];

  const result: Record<string, string> = {};

  const slots = [
    "dk1", "lt1", "dk2", "lt2",
    "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
    "hlink", "folHlink",
  ];

  for (const slot of slots) {
    const slotMatch = block.match(new RegExp(`<a:${slot}>([\\s\\S]*?)</a:${slot}>`));
    if (!slotMatch) continue;

    const content = slotMatch[1];

    // Try <a:srgbClr val="RRGGBB"/>
    const srgbMatch = content.match(/<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/);
    if (srgbMatch) {
      result[slot] = "#" + srgbMatch[1].toUpperCase();
      continue;
    }

    // Try <a:sysClr lastClr="RRGGBB"/>
    const sysMatch = content.match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
    if (sysMatch) {
      result[slot] = "#" + sysMatch[1].toUpperCase();
      continue;
    }
  }

  // Build the final theme, falling back to defaults for missing slots
  return {
    lt1: result.lt1 || DEFAULT_THEME.lt1,
    dk1: result.dk1 || DEFAULT_THEME.dk1,
    lt2: result.lt2 || DEFAULT_THEME.lt2,
    dk2: result.dk2 || DEFAULT_THEME.dk2,
    accent1: result.accent1 || DEFAULT_THEME.accent1,
    accent2: result.accent2 || DEFAULT_THEME.accent2,
    accent3: result.accent3 || DEFAULT_THEME.accent3,
    accent4: result.accent4 || DEFAULT_THEME.accent4,
    accent5: result.accent5 || DEFAULT_THEME.accent5,
    accent6: result.accent6 || DEFAULT_THEME.accent6,
    hlink: result.hlink || DEFAULT_THEME.hlink,
    folHlink: result.folHlink || DEFAULT_THEME.folHlink,
  };
}
