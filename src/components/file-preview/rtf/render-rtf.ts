/**
 * Render an RTF AST (from `@jonahschulte/rtf-toolkit`) to HTML.
 *
 * The toolkit's built-in `toHTML()` collapses `{\pard ... \par}` groups into
 * a single `<p>` (it only splits paragraphs on bare `\par`), and every real-
 * world RTF wraps paragraphs in `\pard` groups. We get a flat list of text
 * runs separated by `\n` literals instead.
 *
 * This renderer walks that flat run list and:
 *   1. Splits runs into paragraphs at `\n` boundaries.
 *   2. Promotes large-bold runs to `<h1>/<h2>/<h3>` based on font size.
 *   3. Emits inline formatting (`<strong>/<em>/<u>` + color/size styles).
 *   4. Drops the doc-info bleed-through (`\info` content the parser emits as
 *      plain text in the lead-up before the first \par).
 */
import type {
  RTFDocument,
  RTFNode,
  TextNode,
  CharacterFormatting,
} from "@jonahschulte/rtf-toolkit";

interface Run {
  text: string;
  fmt: CharacterFormatting;
}

/** Split a flat run list into paragraphs, breaking on `\n` boundaries. */
function splitIntoParagraphs(runs: Run[]): Run[][] {
  const paragraphs: Run[][] = [];
  let current: Run[] = [];

  for (const run of runs) {
    if (!run.text) continue;

    // Pure-newline runs are paragraph separators.
    if (/^\n+$/.test(run.text)) {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
      continue;
    }

    // Mixed run with embedded newlines — split it.
    if (run.text.includes("\n")) {
      const parts = run.text.split("\n");
      parts.forEach((part, i) => {
        if (part) current.push({ text: part, fmt: run.fmt });
        if (i < parts.length - 1 && current.length > 0) {
          paragraphs.push(current);
          current = [];
        }
      });
      continue;
    }

    current.push(run);
  }

  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

/**
 * Drop the document-info leak that the toolkit emits before the first real
 * content. We can't reliably guess a title regex, so the heuristic is: drop
 * leading paragraphs whose runs are all unformatted (no bold/italic/size)
 * AND whose text is short.
 */
function trimDocInfoLeak(paragraphs: Run[][]): Run[][] {
  let i = 0;
  while (i < paragraphs.length) {
    const p = paragraphs[i];
    const totalLen = p.reduce((n, r) => n + r.text.length, 0);
    const allUnformatted = p.every(
      (r) =>
        !r.fmt.bold &&
        !r.fmt.italic &&
        !r.fmt.underline &&
        r.fmt.fontSize === undefined,
    );
    // Heuristic: short, no formatting, no rich punctuation → likely info leak.
    const looksLikeInfoLeak = allUnformatted && totalLen < 80;
    if (looksLikeInfoLeak) {
      i++;
      continue;
    }
    break;
  }
  return paragraphs.slice(i);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render a single run with inline formatting tags. */
function renderRun(run: Run, doc: RTFDocument): string {
  let html = escapeHtml(run.text);
  const fmt = run.fmt;

  // Inline color (only if explicitly set, ignore default)
  const styles: string[] = [];
  if (fmt.foregroundColor !== undefined && doc.colorTable[fmt.foregroundColor]) {
    const c = doc.colorTable[fmt.foregroundColor];
    if (c && (c.r !== 0 || c.g !== 0 || c.b !== 0)) {
      styles.push(`color: rgb(${c.r}, ${c.g}, ${c.b})`);
    }
  }
  if (styles.length > 0) {
    html = `<span style="${styles.join("; ")}">${html}</span>`;
  }

  if (fmt.bold) html = `<strong>${html}</strong>`;
  if (fmt.italic) html = `<em>${html}</em>`;
  if (fmt.underline) html = `<u>${html}</u>`;
  return html;
}

/**
 * Pick a block-level tag for a paragraph based on the dominant font size of
 * its first run. RTF font sizes are in half-points: \fs36 → 18pt.
 *   ≥ 30 half-points (15pt+) bold → h1
 *   ≥ 24 (12pt+) bold             → h2
 *   ≥ 20 (10pt+) bold             → h3
 *   otherwise                      → p
 */
function pickBlockTag(runs: Run[]): "h1" | "h2" | "h3" | "p" {
  const lead = runs.find((r) => r.text.trim().length > 0);
  if (!lead) return "p";
  const size = lead.fmt.fontSize;
  if (lead.fmt.bold && size !== undefined) {
    if (size >= 30) return "h1";
    if (size >= 24) return "h2";
    if (size >= 20) return "h3";
  }
  return "p";
}

function renderParagraph(runs: Run[], doc: RTFDocument): string {
  const tag = pickBlockTag(runs);
  // For headings, the first big-bold run defines the heading — strip its
  // bold/size since the heading tag already conveys that.
  const renderRuns =
    tag === "p"
      ? runs
      : runs.map((r) => ({
          text: r.text,
          fmt: { ...r.fmt, bold: false, fontSize: undefined },
        }));
  const inner = renderRuns.map((r) => renderRun(r, doc)).join("");
  return inner.trim() ? `<${tag}>${inner}</${tag}>` : "";
}

/** Flatten paragraph nodes' inline content into a single Run list. */
function collectRuns(nodes: RTFNode[]): Run[] {
  const runs: Run[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph") {
      for (const child of node.content) {
        if (child.type === "text") {
          const t = child as TextNode;
          runs.push({ text: t.content, fmt: t.formatting });
        }
      }
      // Paragraph node itself is a paragraph break.
      runs.push({ text: "\n", fmt: {} });
    } else if (node.type === "text") {
      const t = node as TextNode;
      runs.push({ text: t.content, fmt: t.formatting });
    }
  }
  return runs;
}

/**
 * Convert a parsed RTF AST to clean semantic HTML.
 * Returns a fragment without any wrapper element.
 */
export function renderRtfAstToHtml(doc: RTFDocument): string {
  const runs = collectRuns(doc.content);
  let paragraphs = splitIntoParagraphs(runs);
  paragraphs = trimDocInfoLeak(paragraphs);
  return paragraphs
    .map((p) => renderParagraph(p, doc))
    .filter(Boolean)
    .join("\n");
}
