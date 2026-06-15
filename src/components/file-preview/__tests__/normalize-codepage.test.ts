import { describe, it, expect } from "vitest";
import { normalizeRtfCodepage } from "../rtf/normalize-codepage";

/**
 * Convert an ASCII-ish RTF source string to an ArrayBuffer of Latin-1 bytes.
 * Bytes 0x00-0xff map directly to JS char codes 0x00-0xff, so this round-
 * trips losslessly for control-word RTF (which is 7-bit-clean except for
 * `\'XX` hex escapes that are themselves ASCII).
 */
function rtfBuffer(src: string): ArrayBuffer {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src.charCodeAt(i) & 0xff;
  return out.buffer;
}

function bytesToString(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

describe("normalizeRtfCodepage", () => {
  it("does nothing when \\ansicpg is already declared", () => {
    const src = String.raw`{\rtf1\ansi\ansicpg936\deff0
{\fonttbl{\f0\fcharset134 SimSun;}}
\f0 \'d6\'d0\par}`;
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBeNull();
    expect(bytesToString(bytes)).toBe(src);
  });

  it("does nothing when no informative \\fcharset is present", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0 Arial;}}
Hello world.\par}`;
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBeNull();
    expect(bytesToString(bytes)).toBe(src);
  });

  it("does nothing for non-RTF input", () => {
    const src = "Plain text, not RTF at all.\n";
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBeNull();
    expect(bytesToString(bytes)).toBe(src);
  });

  it("infers cp936 from \\fcharset134 (GBK Simplified Chinese)", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset134 SimSun;}}
\f0 \'d6\'d0\par}`;
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBe(936);
    expect(bytesToString(bytes)).toContain(`\\ansi\\ansicpg936`);
  });

  it("infers cp950 from \\fcharset136 (Big5 Traditional Chinese)", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset136 PMingLiU;}}
\f0 \'a4\'a4\'b0\'ea\par}`;
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBe(950);
    expect(bytesToString(bytes)).toContain(`\\ansi\\ansicpg950`);
  });

  it("infers cp932 from \\fcharset128 (Shift-JIS)", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset128 MS Mincho;}}
\f0 \'93\'fa\'96\'7b\par}`;
    const { bytes, injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBe(932);
  });

  it("ignores \\fcharset0 (Windows-1252 default) and looks past it", () => {
    // Common: a Latin font listed first, the document's primary CJK font second.
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset0 Arial;}{\f1\fcharset134 SimSun;}}
\f1 \'d6\'d0\par}`;
    const { injectedCodepage } = normalizeRtfCodepage(rtfBuffer(src));
    expect(injectedCodepage).toBe(936);
  });

  it("preserves byte length except for the inserted \\ansicpgN bytes", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset134 SimSun;}}
\'d6\'d0\par}`;
    const { bytes } = normalizeRtfCodepage(rtfBuffer(src));
    // `\ansicpg936` = 11 chars added.
    expect(bytes.byteLength).toBe(src.length + 11);
  });

  it("inserts AFTER \\ansi without breaking the keyword (e.g. doesn't disturb \\ansicpg if matched as substring)", () => {
    const src = String.raw`{\rtf1\ansi\deff0
{\fonttbl{\f0\fcharset134 SimSun;}}
hi\par}`;
    const { bytes } = normalizeRtfCodepage(rtfBuffer(src));
    const out = bytesToString(bytes);
    // Sanity: only one \ansicpg, and \ansi is still a valid keyword.
    expect((out.match(/\\ansicpg/g) ?? []).length).toBe(1);
    expect(out).toMatch(/\\ansi\\ansicpg936\\deff0/);
  });
});
