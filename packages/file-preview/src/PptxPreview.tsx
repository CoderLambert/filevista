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
 * Build the CSS string injected into the iframe to override pptx-preview's
 * inline styles.
 */
function buildIframeCss(mode: PptxViewMode): string {
  const base = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: transparent !important;
    }
    button, [class*="pre-btn"], [class*="next-btn"], [class*="pagination"] {
      display: none !important;
    }
    /* Wrapper fills container width */
    [class*="pptx-preview-wrapper"] {
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* Slide wrappers are positioned relative for absolute inner content */
    [class*="pptx-preview-slide"] {
      position: relative !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow: hidden !important;
      background: white;
    }
    /* Inner content div maintains original 960x540 size, scaled via JS */
    [class*="pptx-preview-slide"] > div[style] {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
    }
  `;

  if (mode === "grid") {
    return base + `
      body { display: flex; flex-direction: column; align-items: center; padding: 1.5rem; }
      [class*="pptx-preview-slide"] {
        margin: 0 auto 1.5rem auto !important;
        border-radius: 12px;
        box-shadow:
          0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06),
          0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      }
    `;
  }

  return base + `
    body { display: flex; flex-direction: column; align-items: center; }
    [class*="pptx-preview-slide"] {
      margin: 0 auto !important;
      border-radius: 8px;
      box-shadow:
        0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06),
        0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    }
  `;
}

/**
 * Clone the rendered DOM from the hidden container into the iframe and inject
 * our override CSS. Called on initial render and on every MutationObserver
 * tick (navigation, async image loads, etc.).
 */
function syncIframeContent(
  iframe: HTMLIFrameElement,
  sourceContainer: HTMLElement,
  mode: PptxViewMode
) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Ensure basic HTML structure
  if (!doc.head) {
    doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    doc.close();
  }

  // Inject / update CSS
  let styleEl = doc.getElementById("fv-pptx-iframe-style") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = "fv-pptx-iframe-style";
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = buildIframeCss(mode);

  // Clone rendered DOM into iframe body
  const clone = sourceContainer.cloneNode(true) as HTMLElement;
  hideBrokenImages(clone);

  // Remove navigation buttons from clone
  clone
    .querySelectorAll(
      "button, [class*='pre-btn'], [class*='next-btn'], [class*='pagination']"
    )
    .forEach((el) => el.remove());

  // Apply responsive scaling to each slide wrapper
  const slideWrappers = clone.querySelectorAll<HTMLElement>(
    '[class*="pptx-preview-slide"]'
  );

  slideWrappers.forEach((wrapper) => {
    // The inner div that has transform: scale() from the library
    const innerDiv = wrapper.querySelector<HTMLElement>("div[style]");
    if (innerDiv) {
      // Reset library's inline styles
      innerDiv.style.transform = "none";
      innerDiv.style.position = "absolute";
      innerDiv.style.top = "0";
      innerDiv.style.left = "0";
      innerDiv.style.width = `${PPTX_BASE_WIDTH}px`;
      innerDiv.style.height = `${PPTX_BASE_HEIGHT}px`;
      innerDiv.style.transformOrigin = "top left";
    }

    // Reset wrapper
    wrapper.style.transform = "none";
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.style.overflow = "hidden";
  });

  doc.body.innerHTML = "";
  doc.body.appendChild(clone);

  // Function to calculate and apply scale
  const applyScale = () => {
    slideWrappers.forEach((wrapper) => {
      const actualWidth = wrapper.clientWidth;
      if (actualWidth > 0) {
        const scale = actualWidth / PPTX_BASE_WIDTH;
        const innerDiv = wrapper.querySelector<HTMLElement>("div[style]");
        if (innerDiv) {
          innerDiv.style.transform = `scale(${scale})`;
        }
        wrapper.style.height = `${PPTX_BASE_HEIGHT * scale}px`;
      }
    });
  };

  // Apply scale after DOM is inserted
  requestAnimationFrame(() => {
    applyScale();
    // Apply again after a short delay to ensure layout is complete
    setTimeout(applyScale, 50);
  });

  // Use ResizeObserver to re-apply scale when iframe resizes
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => applyScale());
    resizeObserver.observe(doc.body);
    slideWrappers.forEach((wrapper) => resizeObserver.observe(wrapper));
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
  // Hidden container where pptx-preview actually renders (library's document calls go here)
  const hiddenRef = useRef<HTMLDivElement>(null);
  // Visible iframe that displays the cloned, style-overridden content
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerRef = useRef<any>(null);
  const slideCountRef = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      goToSlide(index: number) {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const clamped = Math.max(0, Math.min(index, slideCountRef.current - 1));
        try {
          viewer.renderSingleSlide(clamped);
          // MutationObserver will pick up DOM changes and sync to iframe
        } catch (err) {
          console.warn("Slide navigation error:", err);
        }
      },
      nextSlide() {
        const viewer = viewerRef.current;
        if (!viewer) return;
        try {
          viewer.renderNextSlide();
        } catch {}
      },
      prevSlide() {
        const viewer = viewerRef.current;
        if (!viewer) return;
        try {
          viewer.renderPreSlide();
        } catch {}
      },
    }),
    []
  );

  useEffect(() => {
    const hiddenEl = hiddenRef.current;
    const iframe = iframeRef.current;
    if (!hiddenEl || !iframe) return;
    let cancelled = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    // Set up MutationObserver to sync DOM changes (navigation, etc.) to iframe.
    // Debounced to avoid excessive re-cloning during the library's rendering.
    const observer = new MutationObserver(() => {
      if (cancelled || !iframe.contentDocument) return;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        if (!cancelled) {
          syncIframeContent(iframe, hiddenEl, mode);
        }
      }, 16); // One frame delay
    });
    observer.observe(hiddenEl, { childList: true, subtree: true });
    observerRef.current = observer;

    async function render() {
      if (!hiddenEl) return;

      // Destroy previous viewer
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }

      hiddenEl.innerHTML = "";

      try {
        const { init } = await getPptxPreview();
        if (cancelled || !hiddenEl) return;

        const buffer = await readBinaryPreviewAsArrayBuffer({ source, content });
        if (cancelled) return;

        const createViewer = () =>
          init(hiddenEl!, {
            width: baseWidth,
            // In grid mode, omit height so the library does NOT set
            // overflow-y:auto on its internal wrapper.
            height: mode === "grid" ? undefined : baseHeight,
            mode: mode === "grid" ? "list" : "slide",
          });

        let viewer = createViewer();
        viewerRef.current = viewer;

        try {
          await viewer.preview(buffer);
          if (!hiddenEl || !hasRenderedSlides(hiddenEl)) {
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

          hiddenEl.innerHTML = "";
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

          if (!hiddenEl || !hasRenderedSlides(hiddenEl)) {
            throw new Error("PPTX preview produced no rendered slides");
          }
        }
        if (cancelled) return;

        const readyInfo = await getReliableReadyInfo(
          viewer,
          hiddenEl,
          buffer
        );
        slideCountRef.current = readyInfo.slideCount;

        // Initial sync to iframe
        if (iframe) {
          syncIframeContent(iframe, hiddenEl, mode);
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
      observer.disconnect();
      observerRef.current = null;
      if (syncTimer) clearTimeout(syncTimer);

      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {
          // ignore
        }
        viewerRef.current = null;
      }

      if (hiddenEl) {
        hiddenEl.innerHTML = "";
      }
    };
  }, [content, source, mode, baseWidth, baseHeight, onReady, onError]);

  // Auto-resize iframe to match content height
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const resize = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const scrollHeight = doc.body.scrollHeight;
      if (scrollHeight > 0) {
        iframe.style.height = `${scrollHeight}px`;
      }
    };

    resize();
    const interval = setInterval(resize, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`fv-pptx__stage ${mode === "grid" ? "fv-pptx__stage--grid" : ""}`}
      style={
        mode === "slide"
          ? {
              width: baseWidth * scale,
              height: "auto",
              minHeight: baseHeight * scale,
            }
          : undefined
      }
    >
      <div
        className="fv-pptx__scale-layer"
        style={
          mode === "slide"
            ? {
                width: baseWidth,
                height: "auto",
                minHeight: baseHeight,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : {
                width: "100%",
                height: "auto",
                transform: "none",
              }
        }
      >
        {/* Hidden container: pptx-preview renders here (uses document.createElement) */}
        <div
          ref={hiddenRef}
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: `${baseWidth}px`,
            height: `${baseHeight}px`,
            clipPath: "inset(100%)",
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: -1,
          }}
        />
        {/* Visible iframe: cloned content with our CSS injected */}
        <iframe
          ref={iframeRef}
          className={`fv-pptx__iframe ${
            mode === "slide" ? "fv-pptx__iframe--slide" : "fv-pptx__iframe--grid"
          }`}
          style={{
            width: mode === "slide" ? baseWidth : "100%",
            border: "none",
            background: "transparent",
            overflow: "hidden",
          }}
          title="PPTX preview"
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
