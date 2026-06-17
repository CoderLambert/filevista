import type { PreviewSource } from "../core/types";

export type PptxViewMode = "slide" | "grid";

export type PptxFitMode =
  | "contain"
  | "cover"
  | "width"
  | "height"
  | "actual"
  | "scale-down";

export interface PptxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;

  fit?: PptxFitMode;
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  baseWidth?: number;
  baseHeight?: number;

  onReady?: (info: PptxReadyInfo) => void;
  onError?: (error: Error) => void;
  onSlideChange?: (index: number) => void;
}

export interface PptxReadyInfo {
  slideCount: number;
  currentIndex: number;
}

export interface PptxRenderHandle {
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
}

export interface PptxFitState {
  viewportWidth: number;
  viewportHeight: number;
  baseWidth: number;
  baseHeight: number;
  fitScale: number;
  userZoom: number;
  displayScale: number;
  stageWidth: number;
  stageHeight: number;
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
