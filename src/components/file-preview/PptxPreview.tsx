"use client";

import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Grid3X3,
  Monitor,
} from "lucide-react";

interface PptxPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

interface SlideData {
  index: number;
  texts: SlideText[];
  images: SlideImage[];
  rawXml?: string;
}

interface SlideText {
  content: string;
  level: number; // 0 = title-like, 1+ = body text
  fontSize?: number;
  bold?: boolean;
  color?: string;
}

interface SlideImage {
  src: string; // base64 data URL
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

type ViewMode = "slide" | "grid";

// Parse XML text runs to extract formatted text
function extractTextsFromXml(xmlString: string): SlideText[] {
  const texts: SlideText[] = [];

  // Match all <a:p> paragraphs
  const paragraphRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let paraMatch;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paraContent = paraMatch[1];
    let fullText = "";
    let isBold = false;
    let fontSize: number | undefined;
    let level = 1;

    // Check for level attribute on the paragraph
    const lvlMatch = paraContent.match(/<a:pPr\b[^>]*lvl="(\d+)"[^>]*>/);
    if (lvlMatch) {
      level = parseInt(lvlMatch[1]) + 1;
    }

    // Check if paragraph is a title (usually lvl=0 or in a title placeholder)
    const isTitle =
      level === 1 &&
      (paraContent.includes('ph type="title"') ||
        paraContent.includes('ph type="ctrTitle"'));

    // Match all <a:r> runs within the paragraph
    const runRegex = /<a:r\b[^>]*>([\s\S]*?)<\/a:r>/g;
    let runMatch;

    while ((runMatch = runRegex.exec(paraContent)) !== null) {
      const runContent = runMatch[1];

      // Check run properties for bold and font size
      const rPrMatch = runContent.match(/<a:rPr\b[^>]*>/);
      if (rPrMatch) {
        const rPr = rPrMatch[0];
        if (rPr.includes('b="1"') || rPr.includes(' b="true"')) {
          isBold = true;
        }
        const szMatch = rPr.match(/sz="(\d+)"/);
        if (szMatch) {
          fontSize = parseInt(szMatch[1]) / 100; // PPTX uses hundredths of a point
        }
      }

      // Extract text content
      const tMatch = runContent.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (tMatch) {
        fullText += tMatch[1];
      }
    }

    if (fullText.trim()) {
      texts.push({
        content: fullText.trim(),
        level: isTitle ? 0 : level,
        fontSize,
        bold: isBold || isTitle,
      });
    }
  }

  return texts;
}

// Parse slide relationships to find image references
function parseSlideRels(relsXml: string): Map<string, string> {
  const imageMap = new Map<string, string>();
  const relRegex = /<Relationship\s+Id="([^"]+)"\s+Type="[^"]*image[^"]*"\s+Target="([^"]+)"/g;
  let match;
  while ((match = relRegex.exec(relsXml)) !== null) {
    imageMap.set(match[1], match[2]);
  }
  return imageMap;
}

// Extract image references from slide XML
function extractImageRefsFromXml(
  slideXml: string,
  imageRels: Map<string, string>
): string[] {
  const imagePaths: string[] = [];
  const blipRegex = /<a:blip[^>]*r:embed="([^"]+)"[^>]*>/g;
  let match;
  while ((match = blipRegex.exec(slideXml)) !== null) {
    const relId = match[1];
    const target = imageRels.get(relId);
    if (target) {
      // Normalize path - remove leading "../" or "/"
      const normalizedPath = target.replace(/^(\.\.\/)+/, "").replace(/^\//, "");
      imagePaths.push(normalizedPath);
    }
  }
  return imagePaths;
}

async function parsePptx(base64Content: string): Promise<SlideData[]> {
  // Decode base64
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes.buffer);
  const slides: SlideData[] = [];

  // Find all slide files
  const slideFiles: { index: number; path: string }[] = [];
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) {
      slideFiles.push({
        index: parseInt(match[1]),
        path: relativePath,
      });
    }
  });

  // Sort slides by index
  slideFiles.sort((a, b) => a.index - b.index);

  for (const slideFile of slideFiles) {
    const slideXml = await zip.file(slideFile.path)?.async("string");
    if (!slideXml) continue;

    // Extract texts
    const texts = extractTextsFromXml(slideXml);

    // Try to load relationships for images
    const relsPath = `ppt/slides/_rels/slide${slideFile.index}.xml.rels`;
    const relsXml = await zip.file(relsPath)?.async("string");

    const images: SlideImage[] = [];

    if (relsXml) {
      const imageRels = parseSlideRels(relsXml);
      const imageRefs = extractImageRefsFromXml(slideXml, imageRels);

      for (const imageRef of imageRefs) {
        // Try to find the image file in the zip
        const imageFile = zip.file(`ppt/${imageRef}`) || zip.file(imageRef);
        if (imageFile) {
          const imageBlob = await imageFile.async("blob");
          const imageUrl = URL.createObjectURL(imageBlob);
          images.push({ src: imageUrl });
        }
      }
    }

    slides.push({
      index: slideFile.index,
      texts,
      images,
    });
  }

  return slides;
}

function SlideCard({
  slide,
  isActive,
  onClick,
  compact,
}: {
  slide: SlideData;
  isActive?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const title = slide.texts.find((t) => t.level === 0);
  const bodyTexts = slide.texts.filter((t) => t.level > 0);

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border transition-all overflow-hidden ${
        isActive
          ? "ring-2 ring-primary border-primary/30 shadow-md"
          : "border-border hover:shadow-md cursor-pointer"
      } ${compact ? "cursor-pointer hover:ring-1 hover:ring-primary/50" : ""}`}
      style={{ aspectRatio: "16/9" }}
    >
      <div className="w-full h-full flex flex-col p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* Slide number */}
        <div className="text-[10px] text-gray-400 dark:text-gray-600 mb-1 font-mono">
          Slide {slide.index}
        </div>

        {/* Title */}
        {title && (
          <h3
            className={`font-bold text-gray-900 dark:text-gray-100 mb-2 leading-tight line-clamp-2 ${
              compact ? "text-xs" : "text-sm sm:text-base md:text-lg"
            }`}
          >
            {title.content}
          </h3>
        )}

        {/* Body texts */}
        <div className="flex-1 min-h-0 space-y-0.5 sm:space-y-1">
          {bodyTexts.slice(0, compact ? 3 : 8).map((text, i) => (
            <p
              key={i}
              className={`text-gray-600 dark:text-gray-400 leading-snug ${
                compact ? "text-[9px]" : "text-xs sm:text-sm"
              } ${text.level > 1 ? "pl-3" : ""} ${
                i === (compact ? 2 : 7) ? "line-clamp-1" : ""
              }`}
              style={
                !compact && text.fontSize
                  ? { fontSize: `${Math.min(text.fontSize, 18)}px` }
                  : undefined
              }
            >
              {text.bold ? <strong>{text.content}</strong> : text.content}
            </p>
          ))}
          {bodyTexts.length > (compact ? 3 : 8) && (
            <p className="text-gray-400 text-[10px]">
              +{bodyTexts.length - (compact ? 3 : 8)} more items
            </p>
          )}
        </div>

        {/* Images preview */}
        {slide.images.length > 0 && (
          <div className="mt-2 flex gap-1">
            {slide.images.slice(0, 2).map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt={`Slide image ${i + 1}`}
                className={`rounded object-cover ${
                  compact ? "h-6 w-8" : "h-10 w-16"
                }`}
              />
            ))}
            {slide.images.length > 2 && (
              <span className="text-[9px] text-gray-400 self-center">
                +{slide.images.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PptxPreview({ content, fileName }: PptxPreviewProps) {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("slide");

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parsePptx(content);
      setSlides(result);
    } catch (err) {
      console.error("Error parsing PPTX:", err);
      setError(
        err instanceof Error ? err.message : "Failed to parse presentation"
      );
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => {
    parseFile();
  }, [parseFile]);

  // Cleanup image URLs on unmount
  useEffect(() => {
    return () => {
      slides.forEach((slide) => {
        slide.images.forEach((img) => {
          if (img.src.startsWith("blob:")) {
            URL.revokeObjectURL(img.src);
          }
        });
      });
    };
  }, [slides]);

  const goToSlide = (index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, slides.length - 1)));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">
          Parsing presentation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-lg font-medium">Parsing Failed</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
        <p className="text-lg font-medium">No Slides Found</p>
        <p className="text-sm">
          The presentation appears to be empty or could not be parsed.
        </p>
      </div>
    );
  }

  const activeSlide = slides[currentSlide];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {currentSlide + 1} / {slides.length}
          </span>
          <span className="text-xs text-muted-foreground">slides</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("slide")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "slide"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="Slide view"
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "grid"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="Grid view"
          >
            <Grid3X3 size={16} />
          </button>
        </div>

        {viewMode === "slide" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === slides.length - 1}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next slide"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {viewMode === "slide" ? (
          <div className="p-4 md:p-8">
            {/* Main slide */}
            <div className="max-w-4xl mx-auto">
              <SlideCard slide={activeSlide} />

              {/* Slide images - show full size below */}
              {activeSlide.images.length > 0 && (
                <div className="mt-4 space-y-3">
                  {activeSlide.images.map((img, i) => (
                    <div
                      key={i}
                      className="rounded-lg overflow-hidden border bg-white dark:bg-gray-900 p-2"
                    >
                      <img
                        src={img.src}
                        alt={`Slide ${activeSlide.index} - Image ${i + 1}`}
                        className="max-w-full mx-auto rounded"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slide thumbnails strip */}
            <div className="max-w-4xl mx-auto mt-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {slides.map((slide, i) => (
                  <div
                    key={slide.index}
                    onClick={() => goToSlide(i)}
                    className={`shrink-0 w-28 transition-all ${
                      i === currentSlide
                        ? "ring-2 ring-primary rounded-md"
                        : "opacity-60 hover:opacity-100 cursor-pointer rounded-md"
                    }`}
                  >
                    <SlideCard slide={slide} compact />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Grid view */
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
              {slides.map((slide, i) => (
                <div
                  key={slide.index}
                  onClick={() => {
                    setCurrentSlide(i);
                    setViewMode("slide");
                  }}
                  className="cursor-pointer group"
                >
                  <div className="transition-transform group-hover:scale-[1.02]">
                    <SlideCard slide={slide} compact />
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground mt-1 font-mono">
                    Slide {slide.index}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
