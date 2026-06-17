import JSZip from "jszip";
import type {
  PptxSemanticDeck,
  PptxSemanticElement,
  PptxSemanticShape,
  PptxSemanticSlide,
  PptxSemanticText,
} from "./types";

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

export async function readPptxSemanticDeck(
  arrayBuffer: ArrayBuffer
): Promise<PptxSemanticDeck> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");

  if (!presentationXml) {
    throw new Error("Missing ppt/presentation.xml");
  }

  const presentationDoc = parseXml(presentationXml);
  const sizeEl = firstTag(presentationDoc, "p:sldSz");
  const slideWidth = emuToPx(getAttr(sizeEl, "cx")) || 960;
  const slideHeight = emuToPx(getAttr(sizeEl, "cy")) || 540;

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const ai = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const bi = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return ai - bi;
    });

  const slides: PptxSemanticSlide[] = [];
  for (const [index, slideFile] of slideFiles.entries()) {
    const xml = await zip.file(slideFile)?.async("text");
    if (!xml) continue;
    slides.push(parseSlide(xml, index));
  }

  const coreXml = await zip.file("docProps/core.xml")?.async("text");
  let title = "Presentation";
  if (coreXml) {
    const coreDoc = parseXml(coreXml);
    const titleEl =
      coreDoc.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0] ||
      coreDoc.getElementsByTagName("dc:title")[0];
    const rawTitle = titleEl?.textContent?.trim();
    if (rawTitle) {
      title = rawTitle;
    } else if (slides[0]?.title) {
      title = slides[0].title;
    }
  } else if (slides[0]?.title) {
    title = slides[0].title;
  }

  return {
    title,
    width: slideWidth,
    height: slideHeight,
    slides,
  };
}
