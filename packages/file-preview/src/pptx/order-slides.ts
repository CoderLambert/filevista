/**
 * Order PPTX slide XML strings according to the presentation's intended order.
 *
 * PowerPoint stores slide order in `ppt/presentation.xml` via `<p:sldIdLst>`,
 * which references relationship IDs (`r:id`) that resolve to slide file paths
 * via `ppt/_rels/presentation.xml.rels`. PowerPoint does NOT guarantee that
 * `slide1.xml`, `slide2.xml`, ... reflect the user-visible order — reordering
 * slides may leave the original filenames intact.
 *
 * This function resolves the intended order. On any parse failure (missing
 * sldIdLst, missing rels, etc.) it falls back to filename-numeric sorting,
 * which is correct for unmodified presentations.
 */

const SLIDE_PATH_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;

/**
 * Parse an XML attribute value out of an element tag. Robust to attribute
 * order and surrounding whitespace.
 */
function readAttribute(tag: string, attrName: string): string | null {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:\\s|^)${escaped}\\s*=\\s*"([^"]*)"`);
  const match = re.exec(tag);
  return match ? match[1] : null;
}

/**
 * Parse the `<p:sldIdLst>` block in presentation.xml — returns the relationship
 * IDs (`r:id="rIdN"`) in document order.
 */
function parseSldIdList(presentationXml: string): string[] {
  const listMatch = /<p:sldIdLst[^>]*>([\s\S]*?)<\/p:sldIdLst>/.exec(
    presentationXml,
  );
  if (!listMatch) return [];

  const ids: string[] = [];
  // Match the inner attribute string of each <p:sldId> element. We match
  // up to a closing `>`/`/>` rather than excluding `/` so attribute values
  // containing slashes do not truncate the tag content.
  const sldRe = /<p:sldId\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = sldRe.exec(listMatch[1])) !== null) {
    const rid = readAttribute(m[1], "r:id");
    if (rid) ids.push(rid);
  }
  return ids;
}

/**
 * Parse the relationships file to build `rId → Target` map. Targets in
 * presentation.xml.rels are relative to `ppt/` (e.g. `slides/slide1.xml`).
 */
function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml) return map;
  // See sldIdRe above — use `[^>]*?` and an optional trailing `/` so that
  // Target values like `slides/slide1.xml` don't truncate the tag content.
  const relRe = /<Relationship\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = relRe.exec(relsXml)) !== null) {
    const id = readAttribute(m[1], "Id");
    const target = readAttribute(m[1], "Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

/**
 * Normalise a Target value (which is relative to `ppt/`) into the full path
 * used as a Map key in SafePptxArchive.slides — e.g. `slides/slide1.xml`
 * → `ppt/slides/slide1.xml`.
 */
function normaliseTarget(target: string): string {
  // Strip leading "../" — Targets may be specified relative to the rels' parent
  let path = target.replace(/^\/+/, "");
  while (path.startsWith("../")) path = path.slice(3);
  if (!path.startsWith("ppt/")) path = `ppt/${path}`;
  return path;
}

/**
 * Fallback ordering — sort slide map by the numeric suffix in `slideN.xml`.
 * This is correct for PPTX files where slides were never reordered after
 * authoring.
 */
function sortByFilename(slides: Map<string, string>): string[] {
  return [...slides.entries()]
    .filter(([name]) => SLIDE_PATH_PATTERN.test(name))
    .sort((a, b) => {
      const ai = Number(a[0].match(/slide(\d+)\.xml/)?.[1] || 0);
      const bi = Number(b[0].match(/slide(\d+)\.xml/)?.[1] || 0);
      return ai - bi;
    })
    .map(([, xml]) => xml);
}

export function orderSlidesByPresentation(
  slides: Map<string, string>,
  presentationXml: string,
  presentationRels: string,
): string[] {
  const rids = parseSldIdList(presentationXml);
  const relMap = parseRelationships(presentationRels);

  if (rids.length === 0 || relMap.size === 0) {
    return sortByFilename(slides);
  }

  const ordered: string[] = [];
  for (const rid of rids) {
    const target = relMap.get(rid);
    if (!target) continue;
    const fullPath = normaliseTarget(target);
    const xml = slides.get(fullPath);
    if (xml) ordered.push(xml);
  }

  // If the rels-driven resolution produced nothing (mismatched paths,
  // unusual rels structure), fall back to filename ordering so the
  // fallback UI still has content.
  if (ordered.length === 0) return sortByFilename(slides);

  return ordered;
}