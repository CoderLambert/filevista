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
 * Extract a lightweight structural summary from PPTX slide XML strings.
 * Used as a fallback when high-fidelity rendering fails — shows slide
 * titles, text snippets, and image counts instead of a bare error.
 *
 * Accepts already-parsed slide XMLs (from safe zip parsing) so that
 * ZIP security limits are enforced upstream, not bypassed here.
 */
export async function readPptxInsight(
  slideXmls: string[]
): Promise<PptxInsight> {
  const slides: PptxSlideInsight[] = [];
  let totalImages = 0;

  for (const xml of slideXmls) {
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
