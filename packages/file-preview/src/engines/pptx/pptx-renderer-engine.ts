import type { PreviewSource } from "../../core/types";
import { readSourceAsArrayBuffer } from "../../core/source";

export type PptxRenderMode = "list" | "slide";

export type PptxFitMode = "contain" | "none";

export interface PptxViewerController {
  readonly slideCount: number;
  readonly currentSlideIndex: number;
  readonly zoomPercent: number;
  readonly fitMode: PptxFitMode;

  renderSlide(index?: number): Promise<void>;
  renderList(options?: {
    windowed?: boolean;
    initialSlides?: number;
    batchSize?: number;
    overscanViewport?: number;
  }): Promise<void>;
  goToSlide(index: number, scrollOptions?: ScrollIntoViewOptions): Promise<void>;
  setZoom(percent: number): Promise<void>;
  setFitMode(mode: PptxFitMode): Promise<void>;
  destroy(): void;
}

export interface OpenPptxViewerOptions {
  source: PreviewSource;
  container: HTMLElement;
  scrollContainer?: HTMLElement;
  renderMode?: PptxRenderMode;
  signal?: AbortSignal;
  initialZoom?: number;

  onSlideChange?: (index: number) => void;
  onSlideRendered?: (index: number, element: HTMLElement) => void;
  onSlideError?: (index: number, error: unknown) => void;
  onNodeError?: (nodeId: string, error: unknown) => void;
  onRenderStart?: () => void;
  onRenderComplete?: () => void;
}

export async function openPptxViewer({
  source,
  container,
  scrollContainer,
  renderMode = "list",
  signal,
  initialZoom,
  onSlideChange,
  onSlideRendered,
  onSlideError,
  onNodeError,
  onRenderStart,
  onRenderComplete,
}: OpenPptxViewerOptions): Promise<PptxViewerController> {
  const [rendererModule, buffer] = await Promise.all([
    import("@aiden0z/pptx-renderer"),
    readSourceAsArrayBuffer(source, { signal }),
  ]);

  if (signal?.aborted) {
    throw new DOMException("PPTX rendering was aborted", "AbortError");
  }

  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = rendererModule;

  const viewer = await PptxViewer.open(buffer, container, {
    renderMode,
    zipLimits: RECOMMENDED_ZIP_LIMITS,
    lazySlides: true,
    lazyMedia: true,
    scrollContainer,
    zoomPercent: initialZoom,
    pdfjs: false,
    signal,
    listOptions: {
      windowed: true,
      initialSlides: 4,
      batchSize: 4,
      overscanViewport: 1.5,
    },
    onSlideChange,
    onSlideRendered,
    onSlideError,
    onNodeError,
    onRenderStart,
    onRenderComplete,
  });

  return viewer;
}
