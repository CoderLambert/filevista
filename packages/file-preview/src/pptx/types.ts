import type { PreviewSource } from "../core/types";

export type PptxViewMode = "slide" | "grid";

export interface PptxPreviewProps {
  source: PreviewSource;
  fileName: string;

  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;

  onReady?: (info: PptxReadyInfo) => void;
  onError?: (error: Error) => void;
  onSlideChange?: (index: number) => void;
}

export interface PptxReadyInfo {
  slideCount: number;
  currentIndex: number;
}

export interface PptxSlideInsight {
  title: string;
  textCount: number;
  imageCount: number;
  sampleTexts: string[];
}

export interface PptxInsight {
  title: string;
  slideCount: number;
  imageCount: number;
  slides: PptxSlideInsight[];
}

export interface PptxSemanticDeck {
  title: string;
  width: number;
  height: number;
  slides: PptxSemanticSlide[];
}

export interface PptxSemanticSlide {
  title: string;
  background: string;
  elements: PptxSemanticElement[];
}

export type PptxSemanticElement = PptxSemanticShape | PptxSemanticText;

export interface PptxSemanticShape {
  kind: "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export interface PptxSemanticText {
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
}
