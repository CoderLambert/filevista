/**
 * Normalize valid OOXML comment parts that ExcelJS cannot discover because it
 * assumes Microsoft Excel's conventional part names.
 *
 * OOXML relationship targets may be absolute and comment/VML parts may use
 * arbitrary names. ExcelJS 4.4, however, only indexes `xl/commentsN.xml` and
 * `xl/drawings/vmlDrawingN.vml`, then dereferences those indexes without a
 * missing-entry guard. This helper is intentionally used only after that
 * specific reconciliation failure.
 */

import JSZip from "jszip";

const COMMENTS_RELATIONSHIP = "/comments";
const VML_DRAWING_RELATIONSHIP = "/vmlDrawing";

function getXmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function replaceXmlAttribute(tag: string, name: string, value: string): string {
  return tag.replace(
    new RegExp(`(\\b${name}\\s*=\\s*)(["'])(.*?)\\2`, "i"),
    (_match, prefix: string, quote: string) => `${prefix}${quote}${value}${quote}`,
  );
}

function normalizePartPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveRelationshipTarget(relationshipsPath: string, target: string): string {
  if (target.startsWith("/")) return normalizePartPath(target);

  // `xl/worksheets/_rels/sheet1.xml.rels` belongs to
  // `xl/worksheets/sheet1.xml`, so relative targets start at
  // `xl/worksheets/` rather than at the `_rels` directory.
  const sourcePart = relationshipsPath.replace(/\/_rels\/([^/]+)\.rels$/i, "/$1");
  const sourceDirectory = sourcePart.slice(0, sourcePart.lastIndexOf("/"));
  return normalizePartPath(`${sourceDirectory}/${target}`);
}

function wrapPlainCommentText(xml: string): string {
  // ExcelJS only parses rich-text runs (<text><r><t>…), while some valid
  // producers emit a direct text node (<text><t>…). Preserve its text by
  // wrapping that direct node in a run before the retry.
  return xml.replace(
    /(<text\b[^>]*>)\s*(<t\b[^>]*>[\s\S]*?<\/t>)\s*(<\/text>)/gi,
    "$1<r>$2</r>$3",
  );
}

function availablePartPath(
  zip: JSZip,
  directory: string,
  prefix: string,
  extension: string,
  preferredNumber: number,
  sourcePath: string,
): string {
  let number = preferredNumber;
  while (true) {
    const candidate = `${directory}/${prefix}${number}.${extension}`;
    if (candidate === sourcePath || !zip.file(candidate)) return candidate;
    number += 1;
  }
}

async function rewriteWorksheetRelationships(
  zip: JSZip,
  relationshipsPath: string,
  sheetNumber: number,
): Promise<boolean> {
  const relationshipsFile = zip.file(relationshipsPath);
  if (!relationshipsFile) return false;

  const xml = await relationshipsFile.async("string");
  const relationshipPattern = /<Relationship\b[^>]*\/?\s*>/gi;
  let output = "";
  let lastIndex = 0;
  let changed = false;

  for (const match of xml.matchAll(relationshipPattern)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const type = getXmlAttribute(tag, "Type") ?? "";
    const target = getXmlAttribute(tag, "Target");
    let rewrittenTag = tag;

    if (target && (type.endsWith(COMMENTS_RELATIONSHIP) || type.endsWith(VML_DRAWING_RELATIONSHIP))) {
      const sourcePath = resolveRelationshipTarget(relationshipsPath, target);
      const sourceFile = zip.file(sourcePath);

      if (!sourceFile) {
        // Comments are optional metadata. A dangling optional relationship
        // must not make all worksheet values impossible to preview.
        rewrittenTag = "";
      } else if (type.endsWith(COMMENTS_RELATIONSHIP)) {
        const destinationPath = availablePartPath(
          zip,
          "xl",
          "comments",
          "xml",
          sheetNumber,
          sourcePath,
        );
        const commentXml = wrapPlainCommentText(await sourceFile.async("string"));
        zip.file(destinationPath, commentXml);
        rewrittenTag = replaceXmlAttribute(
          tag,
          "Target",
          `../${destinationPath.slice("xl/".length)}`,
        );
      } else {
        const destinationPath = availablePartPath(
          zip,
          "xl/drawings",
          "vmlDrawing",
          "vml",
          sheetNumber,
          sourcePath,
        );
        zip.file(destinationPath, await sourceFile.async("uint8array"));
        rewrittenTag = replaceXmlAttribute(
          tag,
          "Target",
          `../drawings/${destinationPath.slice("xl/drawings/".length)}`,
        );
      }

      changed ||= rewrittenTag !== tag;
    }

    output += xml.slice(lastIndex, index) + rewrittenTag;
    lastIndex = index + tag.length;
  }

  if (!changed) return false;
  output += xml.slice(lastIndex);
  zip.file(relationshipsPath, output);
  return true;
}

/**
 * Return an ExcelJS-compatible workbook buffer, or `null` when the package did
 * not contain any comment relationships that needed rewriting.
 */
export async function normalizeCommentsForExcelJs(buffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  const zip = await JSZip.loadAsync(buffer);
  const relationshipPaths = Object.keys(zip.files).filter((path) =>
    /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/i.test(path),
  );

  let changed = false;
  for (const relationshipsPath of relationshipPaths) {
    const sheetNumber = Number(relationshipsPath.match(/sheet(\d+)\.xml\.rels$/i)?.[1] ?? 1);
    changed = (await rewriteWorksheetRelationships(zip, relationshipsPath, sheetNumber)) || changed;
  }

  if (!changed) return null;
  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
