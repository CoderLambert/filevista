/**
 * Codepage normalization for RTF input.
 *
 * rtf.js defaults to Windows-1252 when a document declares only `\rtf1\ansi`
 * without `\ansicpgN`. Files that look like
 *
 *   {\rtf1\ansi\deff0
 *   {\fonttbl{\f0\fcharset134 SimSun;}}
 *   \f0 \'d6\'d0\'b9\'fa\par}
 *
 * (very common in legacy WPS / Mac TextEdit exports) then decode as
 * mojibake even though the font table tells us the document is GBK-encoded.
 *
 * Fix: sniff the font table for the first non-default `\fcharsetN`, map it
 * to a Windows codepage, and inject `\ansicpgN` after `\ansi`. We never
 * overwrite an existing `\ansicpg` — the document author knows best.
 *
 * RTF is 7-bit-clean (non-ASCII bytes always get escaped as `\'XX` or `\uN`),
 * so we operate on the bytes as Latin-1 without changing semantics.
 */

/**
 * Map RTF `\fcharsetN` values to Windows codepages.
 * Mirrors the `_charsetMap` in rtf.js's Helper.ts.
 */
const FCHARSET_TO_CODEPAGE: Record<number, number> = {
  0: 1252, // ANSI (default Latin-1) — never inject this
  // 2:   42      Symbol — pseudo
  77: 10000, // Mac Roman
  78: 10001, // Mac Japanese
  79: 10003, // Mac Korean
  80: 10008, // Mac Simplified Chinese
  81: 10002, // Mac Traditional Chinese
  128: 932, // Shift-JIS (Japanese)
  129: 949, // EUC-KR (Korean)
  130: 1361, // Johab (Korean)
  134: 936, // GBK (Simplified Chinese)
  136: 950, // Big5 (Traditional Chinese)
  161: 1253, // Greek
  162: 1254, // Turkish
  163: 1258, // Vietnamese
  177: 1255, // Hebrew
  178: 1256, // Arabic
  186: 1257, // Baltic
  204: 1251, // Cyrillic
  222: 874, // Thai
  238: 1250, // Eastern European
};

/**
 * Look at the bytes (as Latin-1 string), find a `\fcharsetN` for which
 * `_charsetMap[N]` is a non-1252 codepage, and return that codepage.
 *
 * Returns `null` if no useful charset is declared — caller leaves the
 * stream unchanged.
 */
function detectCharsetFromFontTable(rtfText: string): number | null {
  // Limit search to the document header area (first ~8 KB). The font table
  // is always declared near the top, and scanning the entire document
  // would risk matching `\fcharsetN` inside style/list overrides which
  // are unrelated to the document's primary encoding.
  const header = rtfText.slice(0, 8192);

  // Find every \fcharsetN occurrence in the header. We pick the FIRST
  // one with a CJK / non-Latin mapping — that's the document's primary
  // text font, the one rtf.js will use for unscoped text.
  const re = /\\fcharset(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    const charset = parseInt(m[1], 10);
    const cp = FCHARSET_TO_CODEPAGE[charset];
    if (cp && cp !== 1252) return cp;
  }
  return null;
}

/**
 * Inject `\ansicpgN` after `\ansi` in the byte stream. Returns the
 * modified Uint8Array, or `bytes` unchanged if no injection happened.
 */
function injectAnsiCpg(bytes: Uint8Array, codepage: number): Uint8Array {
  // Decode as Latin-1 — every byte maps 1:1 to a JS char in 0x00-0xff,
  // so bytewise edits to ASCII regions stay byte-identical.
  const text = new TextDecoder("latin1").decode(bytes);

  // Already has \ansicpg? Don't second-guess.
  if (/\\ansicpg\d/.test(text)) return bytes;

  // Insert right after `\ansi` (not `\ansiN` — `\ansicpg` is what we want
  // to avoid colliding with). Only one replacement.
  const patched = text.replace(
    /\\ansi(?=[^a-zA-Z0-9])/,
    `\\ansi\\ansicpg${codepage}`,
  );
  if (patched === text) return bytes; // \ansi not found — leave alone

  // Re-encode. TextEncoder produces UTF-8; for ASCII-only modifications
  // we want byte-identical output, so write a Latin-1 array manually.
  const out = new Uint8Array(patched.length);
  for (let i = 0; i < patched.length; i++) {
    out[i] = patched.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * Public entry point: take RTF bytes, return either the same bytes or a
 * patched copy with `\ansicpgN` injected based on font-table sniffing.
 *
 * Also returns the codepage that was applied (or `null`) — callers can
 * use this for diagnostic logging.
 */
export function normalizeRtfCodepage(buffer: ArrayBuffer): {
  bytes: Uint8Array;
  injectedCodepage: number | null;
} {
  const bytes = new Uint8Array(buffer);

  // Cheap header peek — if we can't even decode the first bytes as RTF,
  // skip the work and let rtf.js produce its own error.
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 256));
  if (!head.trimStart().startsWith("{\\rtf")) {
    return { bytes, injectedCodepage: null };
  }

  // Already declares its codepage? Trust it.
  if (/\\ansicpg\d/.test(head)) {
    return { bytes, injectedCodepage: null };
  }

  const text = new TextDecoder("latin1").decode(bytes);
  const cp = detectCharsetFromFontTable(text);
  if (cp === null) {
    return { bytes, injectedCodepage: null };
  }

  return { bytes: injectAnsiCpg(bytes, cp), injectedCodepage: cp };
}
