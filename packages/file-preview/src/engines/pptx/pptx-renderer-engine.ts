/**
 * @aiden0z/pptx-renderer bridge — viewer initialization and safe fallback ZIP parsing.
 *
 * This module is the single point of integration with the upstream PPTX rendering
 * library. It handles:
 *
 *   1. Viewer initialisation (openPptxViewer) — wraps new PptxViewer + open + destroy
 *      to guarantee cleanup on failure.
 *   2. Safe fallback ZIP parsing (parsePptxZip) — uses the upstream `parseZipLazyMedia`
 *      with RECOMMENDED_ZIP_LIMITS so fallback code does not bypass security limits.
 */

export interface SafePptxArchive {
  presentation: string;
  slides: Map<string, string>;
  presentationRels: string;
}

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
  input: ArrayBuffer;
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

/**
 * Open a PPTX viewer using @aiden0z/pptx-renderer, with guaranteed resource
 * cleanup on failure.
 *
 * Unlike the upstream static `PptxViewer.open()` convenience method, we
 * manually construct `new PptxViewer()` and call `.open()` so that if the
 * open step fails (e.g. corrupted PPTX, signal abort), we can call
 * `.destroy()` to release any partial resources (DOM nodes, observers, etc.)
 * that the constructor may have created.
 *
 * The provided `input` (ArrayBuffer) is treated as the sole source — the
 * caller is responsible for reading it from the PreviewSource upstream. This
 * avoids duplicate fetches when the same buffer is also needed by fallback
 * code paths.
 */
export async function openPptxViewer({
  input,
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
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
    "@aiden0z/pptx-renderer"
  );

  const viewerOptions = {
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
  };

  const ViewerCtor = PptxViewer as unknown as new (
    container: HTMLElement,
    options?: Record<string, unknown>,
  ) => PptxViewerController & {
    open(input: ArrayBuffer, options?: Record<string, unknown>): Promise<void>;
  };

  const viewer = new ViewerCtor(container, viewerOptions);

  try {
    await viewer.open(input, viewerOptions);
    return viewer;
  } catch (error) {
    viewer.destroy();
    throw error;
  }
}

/**
 * Safely parse a PPTX zip archive using @aiden0z/pptx-renderer's
 * `parseZipLazyMedia` with RECOMMENDED_ZIP_LIMITS enforced.
 *
 * Uses `parseZipLazyMedia` (rather than `parseZip`) because fallback code
 * only needs presentation XML + slide XML — it does not need embedded images,
 * audio, or video. Lazily parsing avoids decompressing large media files
 * into memory just for the fallback path.
 */
export async function parsePptxZip(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<SafePptxArchive> {
  const {
    parseZipLazyMedia: doParse,
    RECOMMENDED_ZIP_LIMITS,
  }: {
    parseZipLazyMedia: (
      buffer: ArrayBuffer,
      limits?: Record<string, number>,
    ) => Promise<{
      presentation: string;
      slides: Map<string, string>;
      presentationRels?: string;
    }>;
    RECOMMENDED_ZIP_LIMITS: Record<string, number>;
  } = await import("@aiden0z/pptx-renderer");

  if (signal?.aborted) {
    throw new DOMException("PPTX fallback parsing was aborted", "AbortError");
  }

  const files = await doParse(buffer, RECOMMENDED_ZIP_LIMITS);

  if (signal?.aborted) {
    throw new DOMException("PPTX fallback parsing was aborted", "AbortError");
  }

  return {
    presentation: files.presentation,
    slides: files.slides,
    presentationRels: files.presentationRels || "",
  };
}