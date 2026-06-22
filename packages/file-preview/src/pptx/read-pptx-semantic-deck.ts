import type {
  PptxSemanticDeck,
  PptxSemanticElement,
  PptxSemanticShape,
  PptxSemanticSlide,
  PptxSemanticText,
} from "./types";
import { throwIfAbortedCompat } from "../core/abort-compat";
import { PPTX_FALLBACK_LIMITS } from "./constants";

const FALLBACK_BG = "#0D1117";
type XmlRoot = Document | Element;

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function emuToPx(value: string | null | undefined) {
  return Number(value || 0) / 12700;
}

function getAttr(el: Element | null | undefined, name: string) {
  return el?.getAttribute(name) || null;
}

function firstTag(root: XmlRoot, tagName: string) {
  return root.getElementsByTagName(tagName)[0] || null;
}

function allTags(root: XmlRoot, tagName: string): Element[] {
  return Array.from(root.getElementsByTagName(tagName)) as Element[];
}

function getSolidFillColor(root: XmlRoot | null | undefined) {
  if (!root) return null;

  const srgb = firstTag(root, "a:srgbClr");
  if (srgb) {
    const value = getAttr(srgb, "val");
    return value ? `#${value}` : null;
  }

  return null;
}

function getShapeBounds(shapeEl: Element) {
  const xfrm = firstTag(shapeEl, "a:xfrm");
  const off = firstTag(xfrm ?? shapeEl, "a:off");
  const ext = firstTag(xfrm ?? shapeEl, "a:ext");

  return {
    x: emuToPx(getAttr(off, "x")),
    y: emuToPx(getAttr(off, "y")),
    width: emuToPx(getAttr(ext, "cx")),
    height: emuToPx(getAttr(ext, "cy")),
  };
}

function getParagraphText(paragraph: Element) {
  return allTags(paragraph, "a:t")
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean)
    .join("");
}

function getShapeText(shapeEl: Element) {
  const txBody = firstTag(shapeEl, "p:txBody");
  if (!txBody) return "";

  return allTags(txBody, "a:p")
    .map(getParagraphText)
    .filter(Boolean)
    .join("\n");
}

function getTextStyle(shapeEl: Element): Pick<
  PptxSemanticText,
  "color" | "fontSize" | "bold" | "italic" | "align" | "verticalAlign"
> {
  const txBody = firstTag(shapeEl, "p:txBody");
  const bodyPr = firstTag(txBody ?? shapeEl, "a:bodyPr");
  const paragraph = firstTag(txBody ?? shapeEl, "a:p");
  const paragraphProps = firstTag(paragraph ?? shapeEl, "a:pPr");
  const runProps =
    firstTag(paragraph ?? shapeEl, "a:rPr") ||
    firstTag(paragraph ?? shapeEl, "a:endParaRPr");

  const anchor = getAttr(bodyPr, "anchor");
  const algn = getAttr(paragraphProps, "algn");

  return {
    color: getSolidFillColor(runProps) || "#FFFFFF",
    fontSize: Number(getAttr(runProps, "sz") || 1800) / 100,
    bold: getAttr(runProps, "b") === "1",
    italic: getAttr(runProps, "i") === "1",
    align:
      algn === "ctr" ? "center" : algn === "r" ? "right" : "left",
    verticalAlign:
      anchor === "ctr" ? "center" : anchor === "b" ? "bottom" : "top",
  };
}

function parseShapeElement(shapeEl: Element): PptxSemanticElement[] {
  const bounds = getShapeBounds(shapeEl);
  if (bounds.width <= 0 || bounds.height <= 0) return [];

  const shapeProps = firstTag(shapeEl, "p:spPr");
  const fill = getSolidFillColor(shapeProps);
  const text = getShapeText(shapeEl);
  const elements: PptxSemanticElement[] = [];

  if (fill) {
    const shape: PptxSemanticShape = {
      kind: "shape",
      ...bounds,
      fill,
    };
    elements.push(shape);
  }

  if (text) {
    const textStyle = getTextStyle(shapeEl);
    const textElement: PptxSemanticText = {
      kind: "text",
      ...bounds,
      text,
      ...textStyle,
    };
    elements.push(textElement);
  }

  return elements;
}

function getSlideTitle(elements: PptxSemanticElement[], fallbackIndex: number) {
  const title = elements.find(
    (element): element is PptxSemanticText =>
      element.kind === "text" && element.text.trim().length > 0
  );

  return title?.text.split("\n")[0] || `Slide ${fallbackIndex + 1}`;
}

function parseSlide(xml: string, index: number): PptxSemanticSlide {
  const doc = parseXml(xml);
  const spTree = firstTag(doc, "p:spTree");
  const shapes = spTree ? allTags(spTree, "p:sp") : [];
  const elements = shapes.flatMap(parseShapeElement);
  const background =
    getSolidFillColor(firstTag(doc, "p:bgPr") ?? firstTag(doc, "p:bg")) ||
    FALLBACK_BG;

  return {
    title: getSlideTitle(elements, index),
    background,
    elements,
  };
}

function parseSlideSize(presentationXml: string): {
  width: number;
  height: number;
} {
  const doc = parseXml(presentationXml);
  const sizeEl = firstTag(doc, "p:sldSz");
  return {
    width: emuToPx(getAttr(sizeEl, "cx")) || 960,
    height: emuToPx(getAttr(sizeEl, "cy")) || 540,
  };
}

/**
 * Build a semantic slide deck from pre-parsed PPTX XML strings.
 *
 * Accepts already-parsed XML so ZIP security limits are enforced
 * upstream (via @aiden0z/pptx-renderer's parseZip), not bypassed
 * with a direct JSZip.loadAsync() call.
 */
export async function readPptxSemanticDeck(
  presentationXml: string,
  slideXmls: string[],
  signal?: AbortSignal,
): Promise<PptxSemanticDeck> {
  const { width, height } = parseSlideSize(presentationXml);

  const maxSlides = Math.min(slideXmls.length, PPTX_FALLBACK_LIMITS.maxSlides);
  const slides: PptxSemanticSlide[] = [];

  for (let index = 0; index < maxSlides; index++) {
    throwIfAbortedCompat(signal);
    const xml = slideXmls[index];
    if (!xml) continue;

    // Yield to the main thread periodically so that a presentation with
    // hundreds of slides does not freeze the tab during fallback parsing.
    if (index > 0 && index % PPTX_FALLBACK_LIMITS.yieldEverySlides === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      throwIfAbortedCompat(signal);
    }

    slides.push(parseSlide(xml, index));
  }

  const title = slides[0]?.title || "Presentation";

  return {
    title,
    width,
    height,
    slides,
  };
}
