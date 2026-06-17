import JSZip from "jszip";
import type { PptxInsight, PptxSlideInsight } from "./types";

function extractTextFromSlideXml(xml: string): string[] {
  const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];

  return matches
    .map((match) =>
      match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    )
    .filter(Boolean);
}

function countMatches(xml: string, pattern: RegExp): number {
  return [...xml.matchAll(pattern)].length;
}

/**
 * Extract a lightweight structural summary from a PPTX ArrayBuffer.
 * Used as a fallback when high-fidelity rendering fails — shows slide
 * titles, text snippets, and image counts instead of a bare error.
 */
export async function readPptxInsight(
  arrayBuffer: ArrayBuffer
): Promise<PptxInsight> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const ai = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const bi = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return ai - bi;
    });

  const slides: PptxSlideInsight[] = [];
  let totalImages = 0;

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile)?.async("text");
    if (!xml) continue;

    const texts = extractTextFromSlideXml(xml);
    const imageCount = countMatches(xml, /<a:blip\b/g);

    totalImages += imageCount;

    slides.push({
      title: texts[0] || `Slide ${slides.length + 1}`,
      textCount: texts.length,
      imageCount,
      sampleTexts: texts.slice(0, 8),
    });
  }

  return {
    title: slides[0]?.title || "Presentation",
    slideCount: slides.length,
    imageCount: totalImages,
    slides,
  };
}
