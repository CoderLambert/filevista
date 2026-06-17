import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Grid3X3Icon,
  MonitorIcon,
  AlertTriangleIcon,
  ZoomInIcon,
  ZoomOutIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "./icons";
import { readBinaryPreviewAsArrayBuffer } from "./core/binary";
import type { PreviewSource } from "./core/types";
import { useLocale } from "./core/i18n";
import { usePptxFitScale } from "./pptx/usePptxFitScale";
import { readPptxInsight } from "./pptx/read-pptx-insight";
import { readPptxSemanticDeck } from "./pptx/read-pptx-semantic-deck";
import { normalizePptxPreviewModel } from "./pptx/normalize-preview-model";
import { PptxSummaryFallback } from "./PptxSummaryFallback";
import { PptxSemanticFallback } from "./PptxSemanticFallback";
import type {
  PptxFitMode,
  PptxInsight,
  PptxPreviewProps,
  PptxRenderHandle,
  PptxReadyInfo,
  PptxSemanticDeck,
  PptxViewMode,
} from "./pptx/types";
import {
  PPTX_BASE_WIDTH,
  PPTX_BASE_HEIGHT,
  PPTX_MAX_ZOOM,
  PPTX_MIN_ZOOM,
  PPTX_ZOOM_STEP,
} from "./pptx/constants";
import "./styles/PptxPreview.css";

/**
 * Lightweight post-render: silently replace images that browsers can't display
 * (e.g. EMF/WMF) with a barely-visible dotted-border placeholder instead of
 * the default broken-image icon.
 */
const UNSUPPORTED_IMG_FORMATS = [
  "image/x-emf",
  "image/x-wmf",
  "image/emf",
  "image/wmf",
];

function hideBrokenImages(container: HTMLElement) {
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.src || "";
    const isUnsupported = UNSUPPORTED_IMG_FORMATS.some(
      (fmt) => src.startsWith(`data:${fmt}`) || src.includes(fmt)
    );
    if (isUnsupported) {
      img.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
      img.style.opacity = "0.15";
      img.style.background =
        "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 0 0 / 8px 8px";
    }
  });
}

/**
 * Remove internal scrollbars and navigation elements injected by pptx-preview.
 * In slide mode we enforce overflow:hidden on every descendant to prevent
 * nested scrolling that breaks the fit-to-container layout.
 */
function cleanupPptxPreviewDom(container: HTMLElement, mode: PptxViewMode) {
  hideBrokenImages(container);

  const navElements = container.querySelectorAll(
    ".pre-btn, .next-btn, .pagination, [class*='pre-btn'], [class*='next-btn'], [class*='pagination'], button"
  );
  navElements.forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });

  if (mode === "slide") {
    const candidates = container.querySelectorAll<HTMLElement>("*");
    candidates.forEach((el) => {
      const style = window.getComputedStyle(el);
      const hasScroll =
        style.overflow === "auto" ||
        style.overflow === "scroll" ||
        style.overflowX === "auto" ||
        style.overflowX === "scroll" ||
        style.overflowY === "auto" ||
        style.overflowY === "scroll";

      if (hasScroll) {
        el.style.overflow = "hidden";
        el.style.overflowX = "hidden";
        el.style.overflowY = "hidden";
      }
    });
  }
}

function getViewerReadyInfo(viewer: any): PptxReadyInfo {
  const slideCount = Math.max(
    0,
    Number(viewer?.pptx?.slides?.length ?? viewer?.slideCount ?? 0)
  );
  const currentIndex =
    typeof viewer?.currentIndex === "number" && viewer.currentIndex >= 0
      ? viewer.currentIndex
      : 0;

  return { slideCount, currentIndex };
}

function getRenderedSlideCount(container: HTMLElement) {
  return container.querySelectorAll(".pptx-preview-slide-wrapper").length;
}

function hasRenderedSlides(container: HTMLElement) {
  return getRenderedSlideCount(container) > 0;
}

async function getReliableReadyInfo(
  viewer: any,
  container: HTMLElement,
  buffer: ArrayBuffer
): Promise<PptxReadyInfo> {
  const readyInfo = getViewerReadyInfo(viewer);
  if (readyInfo.slideCount > 0) {
    return readyInfo;
  }

  try {
    const pptxInsight = await readPptxInsight(buffer);
    if (pptxInsight.slideCount > 0) {
      return {
        slideCount: pptxInsight.slideCount,
        currentIndex: readyInfo.currentIndex,
      };
    }
  } catch {
    // Best-effort fallback only.
  }

  const renderedSlideCount = getRenderedSlideCount(container);
  if (renderedSlideCount > 0) {
    return {
      slideCount: renderedSlideCount,
      currentIndex: readyInfo.currentIndex,
    };
  }

  return readyInfo;
}

function isRecoverablePptxPreviewError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return (
    error.message.includes("produced no rendered slides") ||
    error.message.includes("background") ||
    error.message.includes("Cannot read properties of undefined")
  );
}

// Lazy-load pptx-preview to avoid SSR issues
let pptxPreviewModule: typeof import("pptx-preview") | null = null;
async function getPptxPreview() {
  if (!pptxPreviewModule) {
    pptxPreviewModule = await import("pptx-preview");
  }
  return pptxPreviewModule;
}

// ─── PptxRenderContainer ─────────────────────────────────────────────────────

const PptxRenderContainer = forwardRef<
  PptxRenderHandle,
  {
    content?: string | null;
    source?: PreviewSource;
    mode: PptxViewMode;
    scale: number;
    baseWidth?: number;
    baseHeight?: number;
    onReady: (info: PptxReadyInfo) => void;
    onError: (error: Error) => void;
  }
>(function PptxRenderContainer(
  {
    content,
    source,
    mode,
    scale,
    baseWidth = PPTX_BASE_WIDTH,
    baseHeight = PPTX_BASE_HEIGHT,
    onReady,
    onError,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const slideCountRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      goToSlide(index: number) {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const clamped = Math.max(0, Math.min(index, slideCountRef.current - 1));
        try {
          viewer.renderSingleSlide(clamped);
          if (containerRef.current) {
            cleanupPptxPreviewDom(containerRef.current, mode);
          }
        } catch (err) {
          console.warn("Slide navigation error:", err);
        }
      },
      nextSlide() {
        const viewer = viewerRef.current;
        if (!viewer) return;
        try {
          viewer.renderNextSlide();
          if (containerRef.current) {
            cleanupPptxPreviewDom(containerRef.current, mode);
          }
        } catch {}
      },
      prevSlide() {
        const viewer = viewerRef.current;
        if (!viewer) return;
        try {
          viewer.renderPreSlide();
          if (containerRef.current) {
            cleanupPptxPreviewDom(containerRef.current, mode);
          }
        } catch {}
      },
    }),
    [mode]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function render() {
      const container = containerRef.current;
      if (!container) return;

      // Destroy previous viewer
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }

      container.innerHTML = "";

      try {
        const { init } = await getPptxPreview();
        if (cancelled || !containerRef.current) return;

        const buffer = await readBinaryPreviewAsArrayBuffer({ source, content });
        if (cancelled) return;

        const createViewer = () =>
          init(containerRef.current!, {
            width: baseWidth,
            height: baseHeight,
            mode: mode === "grid" ? "list" : "slide",
          });

        let viewer = createViewer();
        viewerRef.current = viewer;

        try {
          await viewer.preview(buffer);
          if (!containerRef.current || !hasRenderedSlides(containerRef.current)) {
            throw new Error("PPTX preview produced no rendered slides");
          }
        } catch (previewError) {
          if (!isRecoverablePptxPreviewError(previewError)) {
            throw previewError;
          }

          try {
            viewer.destroy?.();
          } catch {
            // ignore
          }

          if (containerRef.current) {
            containerRef.current.innerHTML = "";
          }

          viewer = createViewer();
          viewerRef.current = viewer;

          await viewer.load(buffer);
          if (cancelled) return;

          normalizePptxPreviewModel(viewer.pptx);

          const count = viewer.pptx?.slides?.length || viewer.slideCount || 0;
          if (mode === "grid") {
            for (let i = 0; i < count; i += 1) {
              viewer.htmlRender?.renderSlide(i);
            }
            viewer.currentIndex = 0;
          } else if (count > 0) {
            viewer.renderSingleSlide(0);
          }

          if (!containerRef.current || !hasRenderedSlides(containerRef.current)) {
            throw new Error("PPTX preview produced no rendered slides");
          }
        }
        if (cancelled) return;

        const readyInfo = await getReliableReadyInfo(viewer, container, buffer);
        slideCountRef.current = readyInfo.slideCount;

        if (containerRef.current) {
          cleanupPptxPreviewDom(containerRef.current, mode);
        }

        onReady(readyInfo);
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error
              ? err
              : new Error(
                  "PPTX preview failed — file may be corrupted or unsupported"
                )
          );
        }
      }
    }

    render();

    return () => {
      cancelled = true;

      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [content, source, mode, baseWidth, baseHeight, onReady, onError]);

  return (
    <div
      className="fv-pptx__stage"
      style={{
        width: baseWidth * scale,
        height: baseHeight * scale,
      }}
    >
      <div
        className="fv-pptx__scale-layer"
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={containerRef}
          className={`fv-pptx__render-container ${
            mode === "slide"
              ? "fv-pptx__render-container--slide"
              : "fv-pptx__render-container--grid"
          }`}
          style={{
            width: baseWidth,
            height: mode === "slide" ? baseHeight : undefined,
            minHeight: mode === "slide" ? baseHeight : undefined,
          }}
        />
      </div>
    </div>
  );
});

// ─── PptxPreview ──────────────────────────────────────────────────────────────

export function PptxPreview({
  content,
  source,
  fileName,
  fit = "contain",
  initialZoom = 100,
  minZoom = PPTX_MIN_ZOOM,
  maxZoom = PPTX_MAX_ZOOM,
  baseWidth = PPTX_BASE_WIDTH,
  baseHeight = PPTX_BASE_HEIGHT,
  onReady,
  onError,
  onSlideChange,
}: PptxPreviewProps) {
  const t = useLocale();

  const viewportRef = useRef<HTMLDivElement>(null);
  const renderHandleRef = useRef<PptxRenderHandle>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [insight, setInsight] = useState<PptxInsight | null>(null);
  const [semanticDeck, setSemanticDeck] = useState<PptxSemanticDeck | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<PptxViewMode>("slide");
  const [userZoom, setUserZoom] = useState(initialZoom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const fitState = usePptxFitScale({
    viewportRef,
    fit,
    userZoom,
    baseWidth,
    baseHeight,
  });

  const ext = fileName.toLowerCase().split(".").pop() || "";

  const handleReady = useCallback(
    (info: { slideCount: number; currentIndex: number }) => {
      setSlideCount(info.slideCount);
      setCurrentSlide(info.currentIndex);
      setLoading(false);
      setError(null);
      setInsight(null);
      setSemanticDeck(null);
      onReady?.(info);
    },
    [onReady]
  );

  const handleError = useCallback(
    async (err: Error) => {
      setError(err);
      setLoading(false);

      // Try to extract a structural summary for the fallback view
      try {
        const buffer = await readBinaryPreviewAsArrayBuffer({ source, content });
        try {
          const semantic = await readPptxSemanticDeck(buffer);
          if (semantic.slides.length > 0) {
            setSemanticDeck(semantic);
          }
        } catch {
          // Semantic fallback is best-effort.
        }

        const pptxInsight = await readPptxInsight(buffer);
        if (pptxInsight.slideCount > 0) {
          setInsight(pptxInsight);
        }
      } catch {
        // Insight extraction also failed — bare error state is fine
      }

      onError?.(err);
    },
    [onError, source, content]
  );

  const switchViewMode = useCallback((mode: PptxViewMode) => {
    setViewMode(mode);
    setLoading(true);
    setError(null);
    setRenderKey((k) => k + 1);
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      if (viewMode !== "slide") return;
      const clamped = Math.max(0, Math.min(index, slideCount - 1));
      renderHandleRef.current?.goToSlide(clamped);
      setCurrentSlide(clamped);
      onSlideChange?.(clamped);
    },
    [slideCount, viewMode, onSlideChange]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const zoomOut = useCallback(() => {
    setUserZoom((z) => Math.max(minZoom, z - PPTX_ZOOM_STEP));
  }, [minZoom]);

  const zoomIn = useCallback(() => {
    setUserZoom((z) => Math.min(maxZoom, z + PPTX_ZOOM_STEP));
  }, [maxZoom]);

  const resetZoom = useCallback(() => {
    setUserZoom(100);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el =
      viewportRef.current?.closest("[data-preview-container]") ||
      viewportRef.current;

    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  // Fullscreen change → re-measure + optionally remount
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
      // Delay remount to allow fullscreen layout to settle
      setTimeout(() => {
        setRenderKey((k) => k + 1);
      }, 50);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewMode !== "slide" || loading) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextSlide();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, loading, prevSlide, nextSlide]);

  // Detect .ppt files early
  if (ext === "ppt") {
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">{t.formatNotSupported}</p>
        <p className="fv-pptx__error-msg">{t.legacyPptDesc}</p>
      </div>
    );
  }

  if (error) {
    if (semanticDeck) {
      return <PptxSemanticFallback deck={semanticDeck} error={error} />;
    }
    if (insight) {
      return <PptxSummaryFallback insight={insight} error={error} />;
    }
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">{t.previewFailed}</p>
        <p className="fv-pptx__error-msg">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="fv-pptx" data-preview-container>
      {/* Toolbar */}
      <div className="fv-pptx__toolbar">
        <div className="fv-pptx__toolbar-left">
          {viewMode === "slide" ? (
            <>
              <span className="fv-pptx__slide-count">
                {currentSlide + 1} / {slideCount}
              </span>
              <span className="fv-pptx__slide-label">{t.page}</span>
            </>
          ) : (
            <>
              <span className="fv-pptx__slide-count">{slideCount}</span>
              <span className="fv-pptx__slide-label">{t.page}</span>
            </>
          )}
        </div>

        <div className="fv-pptx__toolbar-right">
          {/* View mode toggle */}
          <button
            onClick={() => switchViewMode("slide")}
            className={`fv-pptx__mode-btn ${viewMode === "slide" ? "fv-pptx__mode-btn--active" : ""}`}
            title={t.slideView}
          >
            <MonitorIcon size={16} />
          </button>
          <button
            onClick={() => switchViewMode("grid")}
            className={`fv-pptx__mode-btn ${viewMode === "grid" ? "fv-pptx__mode-btn--active" : ""}`}
            title={t.gridView}
          >
            <Grid3X3Icon size={16} />
          </button>

          <div className="fv-toolbar__separator" />

          {/* Zoom controls */}
          <div className="fv-pptx__zoom-group">
            <button
              onClick={zoomOut}
              className="fv-pptx__zoom-btn"
              title={t.zoomOut}
            >
              <ZoomOutIcon size={14} />
            </button>
            <button
              onClick={resetZoom}
              className="fv-pptx__zoom-label"
              title="Reset zoom"
            >
              {userZoom}%
            </button>
            <button
              onClick={zoomIn}
              className="fv-pptx__zoom-btn"
              title={t.zoomIn}
            >
              <ZoomInIcon size={14} />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="fv-pptx__fullscreen-btn"
            title={t.fullscreen}
          >
            {isFullscreen ? (
              <Minimize2Icon size={16} />
            ) : (
              <Maximize2Icon size={16} />
            )}
          </button>
        </div>

        {viewMode === "slide" && (
          <div className="fv-pptx__nav">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0 || loading}
              className="fv-pptx__nav-btn"
              title={t.previousPage}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide >= slideCount - 1 || loading}
              className="fv-pptx__nav-btn"
              title={t.nextPage}
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div ref={viewportRef} className="fv-pptx__content">
        {loading && (
          <div className="fv-pptx__loading-overlay">
            <div className="fv-spinner fv-spinner--lg" />
            <p className="fv-pptx__loading-label">
              {t.loadingPresentation}
            </p>
          </div>
        )}

        <div
          className={
            viewMode === "slide"
              ? "fv-pptx__slide-wrap"
              : "fv-pptx__grid-wrap"
          }
        >
          <PptxRenderContainer
            key={renderKey}
            ref={renderHandleRef}
            content={content}
            source={source}
            mode={viewMode}
            scale={fitState.displayScale}
            baseWidth={baseWidth}
            baseHeight={baseHeight}
            onReady={handleReady}
            onError={handleError}
          />
        </div>
      </div>
    </div>
  );
}
