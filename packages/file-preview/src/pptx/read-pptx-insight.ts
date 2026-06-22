import type { PptxInsight, PptxSlideInsight } from "./types";
import { throwIfAbortedCompat } from "../core/abort-compat";
import { PPTX_FALLBACK_LIMITS } from "./constants";

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
  slideXmls: string[],
  signal?: AbortSignal,
): Promise<PptxInsight> {
  const slides: PptxSlideInsight[] = [];
  let totalImages = 0;
  let totalXmlBytes = 0;

  const maxSlides = Math.min(slideXmls.length, PPTX_FALLBACK_LIMITS.maxSlides);

  for (let index = 0; index < maxSlides; index++) {
    throwIfAbortedCompat(signal);

    const xml = slideXmls[index];
    const xmlSize = xml.length;
    totalXmlBytes += xmlSize;

    // Yield to the main thread periodically so that a presentation with
    // hundreds of slides does not freeze the tab during fallback parsing.
    if (index > 0 && index % PPTX_FALLBACK_LIMITS.yieldEverySlides === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      throwIfAbortedCompat(signal);
    }

    // Skip slides whose XML exceeds the per-slide byte limit — the
    // structure would be too expensive to parse synchronously.
    if (xmlSize > PPTX_FALLBACK_LIMITS.maxXmlBytesPerSlide) {
      slides.push({
        title: `Slide ${index + 1}`,
        textCount: 0,
        imageCount: 0,
        sampleTexts: [],
      });
      continue;
    }

    const texts = extractTextFromSlideXml(xml);
    const imageCount = countMatches(xml, /<a:blip\b/g);

    totalImages += imageCount;

    slides.push({
      title: texts[0] || `Slide ${index + 1}`,
      textCount: Math.min(texts.length, PPTX_FALLBACK_LIMITS.maxTextItemsPerSlide),
      imageCount,
      sampleTexts: texts.slice(0, 8),
    });
  }

  if (totalXmlBytes > PPTX_FALLBACK_LIMITS.maxTotalXmlBytes) {
    console.warn(
      `[FileVista] PPTX insight fallback parsed ${totalXmlBytes} bytes of slide XML, ` +
      `exceeding limit of ${PPTX_FALLBACK_LIMITS.maxTotalXmlBytes}. Some slides may be missing.`,
    );
  }

  return {
    title: slides[0]?.title || "Presentation",
    slideCount: slides.length,
    imageCount: totalImages,
    slides,
  };
}