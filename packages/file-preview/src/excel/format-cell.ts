/**
 * Excel preview — cell value formatting utilities.
 *
 * Moved from XlsxPreview.tsx to enable reuse across table and
 * spreadsheet transform layers.
 */

/**
 * Format an ExcelJS cell's value to a display string.
 * Handles richText, formula results, hyperlinks, dates, and numbers.
 */
export function formatCellValue(cell: any): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Error) return v.message || "#ERROR";
  if (typeof v === "object" && v !== null && "richText" in v) return formatRichText(v.richText);
  if (typeof v === "object" && v !== null && "formula" in v) {
    const r = v.result;
    return r !== null && r !== undefined ? String(r) : "";
  }
  if (typeof v === "object" && v !== null && "hyperlink" in v) {
    const text = v.text;
    if (text !== null && text !== undefined) return stringifyCellText(text);
    return stringifyCellText(v.hyperlink);
  }
  if (v instanceof Date) return formatDateValue(v, cell.numFmt);
  if (typeof v === "number") return formatNumberValue(v, cell.numFmt);
  return stringifyCellText(v);
}

function stringifyCellText(value: any): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("zh-CN");
  if (typeof value === "object") {
    if ("richText" in value) return formatRichText(value.richText);
    if ("text" in value) return stringifyCellText(value.text);
    if ("result" in value) return stringifyCellText(value.result);
  }
  return String(value);
}

function formatRichText(richText: any): string {
  if (!Array.isArray(richText)) return stringifyCellText(richText);
  return richText.map((part: any) => stringifyCellText(part?.text ?? part)).join("");
}

/**
 * Format a Date using the Excel number format string.
 */
export function formatDateValue(d: Date, fmt: string | undefined): string {
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

/**
 * Format a number using the Excel number format string.
 */
export function formatNumberValue(v: number, fmt: string | undefined): string {
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

/**
 * Convert a number to a fraction string.
 */
export function formatFraction(v: number, fmt: string): string {
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

/** Euclidean algorithm for greatest common divisor. */
export function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }
