import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { readSourceAsArrayBuffer } from "./core/source";
import { useLocale } from "./core/i18n";
import { readPptxInsight } from "./pptx/read-pptx-insight";
import { readPptxSemanticDeck } from "./pptx/read-pptx-semantic-deck";
import { PptxSummaryFallback } from "./PptxSummaryFallback";
import { PptxSemanticFallback } from "./PptxSemanticFallback";
import {
  openPptxViewer,
  parsePptxZip,
  type PptxViewerController,
} from "./engines/pptx/pptx-renderer-engine";
import type {
  PptxInsight,
  PptxPreviewProps,
  PptxReadyInfo,
  PptxSemanticDeck,
  PptxViewMode,
} from "./pptx/types";
import {
  PPTX_MAX_ZOOM,
  PPTX_MIN_ZOOM,
  PPTX_ZOOM_STEP,
} from "./pptx/constants";
import "./styles/PptxPreview.css";

type PptxPreviewState =
  | { status: "loading" }
  | { status: "ready"; slideCount: number }
  | { status: "error"; message: string };

function normalizeZoom(
  value: number,
  min: number,
  max: number,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(Math.max(value, lo), hi);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to parse this PPTX file";
}

function sortSlides(slides: Map<string, string>): string[] {
  return [...slides.entries()]
    .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const ai = Number(a[0].match(/slide(\d+)\.xml/)?.[1] || 0);
      const bi = Number(b[0].match(/slide(\d+)\.xml/)?.[1] || 0);
      return ai - bi;
    })
    .map(([, xml]) => xml);
}

export function PptxPreview({
  source,
  fileName,
  initialZoom = 100,
  minZoom = PPTX_MIN_ZOOM,
  maxZoom = PPTX_MAX_ZOOM,
  onReady,
  onError,
  onSlideChange,
}: PptxPreviewProps) {
  const t = useLocale();

  // Warn on invalid zoom bounds in development; we still self-correct via
  // Math.min/Math.max so a swapped pair won't break the UI.
  if (process.env.NODE_ENV !== "production" && minZoom > maxZoom) {
    console.warn(
      `[PptxPreview] minZoom (${minZoom}) > maxZoom (${maxZoom}); zoom bounds will be auto-swapped.`,
    );
  }

  // Normalized zoom bounds used by every zoom action and the initial state.
  const zoomMin = Math.min(minZoom, maxZoom);
  const zoomMax = Math.max(minZoom, maxZoom);
  const defaultZoom = useMemo(
    () => normalizeZoom(initialZoom, minZoom, maxZoom),
    [initialZoom, minZoom, maxZoom],
  );

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PptxViewerController | null>(null);
  const modeOperationRef = useRef(0);

  const [viewMode, setViewMode] = useState<PptxViewMode>("slide");
  const [state, setState] = useState<PptxPreviewState>({ status: "loading" });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [zoom, setZoomState] = useState(defaultZoom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const [insight, setInsight] = useState<PptxInsight | null>(null);
  const [semanticDeck, setSemanticDeck] = useState<PptxSemanticDeck | null>(null);

  // Latest viewMode/zoom — read by the initialization effect without
  // forcing it to re-run (and thus re-parse the whole PPTX).
  const viewModeRef = useRef<PptxViewMode>(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const initialZoomRef = useRef(defaultZoom);
  useEffect(() => {
    initialZoomRef.current = defaultZoom;
  }, [defaultZoom]);

  const callbacksRef = useRef({ onReady, onError, onSlideChange });
  useEffect(() => {
    callbacksRef.current = { onReady, onError, onSlideChange };
  }, [onReady, onError, onSlideChange]);

  const ext = fileName.toLowerCase().split(".").pop() || "";

  // Mount/destroy effect — runs only when the source changes.
  // Mode/zoom prop changes are applied to the existing viewer instead
  // of re-parsing the PPTX.
  useEffect(() => {
    const abortController = new AbortController();
    let disposed = false;
    const startViewMode = viewModeRef.current;
    const startInitialZoom = initialZoomRef.current;

    async function mountViewer() {
      const container = contentRef.current;
      const scrollContainer = scrollContainerRef.current;
      if (!container || !scrollContainer) return;

      viewerRef.current?.destroy();
      viewerRef.current = null;
      container.replaceChildren();

      setState({ status: "loading" });
      setCurrentSlide(0);
      setZoomState(startInitialZoom);

      try {
        const viewer = await openPptxViewer({
          source,
          container,
          scrollContainer,
          renderMode: startViewMode === "grid" ? "list" : "slide",
          signal: abortController.signal,
          initialZoom: startInitialZoom,

          onSlideChange(index: number) {
            if (!disposed) {
              setCurrentSlide(index);
              callbacksRef.current.onSlideChange?.(index);
            }
          },

          onSlideError(index: number, error: unknown) {
            console.warn(`PPTX slide ${index + 1} failed`, error);
          },

          onNodeError(nodeId: string, error: unknown) {
            console.warn(`PPTX node ${nodeId} failed`, error);
          },
        });

        if (disposed || abortController.signal.aborted) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;

        const readyInfo: PptxReadyInfo = {
          slideCount: viewer.slideCount,
          currentIndex: viewer.currentSlideIndex,
        };

        setState({ status: "ready", slideCount: viewer.slideCount });
        setCurrentSlide(viewer.currentSlideIndex);
        setInsight(null);
        setSemanticDeck(null);
        callbacksRef.current.onReady?.(readyInfo);
      } catch (error: unknown) {
        if (
          disposed ||
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        const message = getErrorMessage(error);
        setState({ status: "error", message });
        callbacksRef.current.onError?.(error instanceof Error ? error : new Error(message));

        // Fallback: parse PPTX through safe zip parsing (enforces security limits)
        // This must not bypass the limits that PptxViewer.open enforces.
        try {
          const buffer = await readSourceAsArrayBuffer(source, {
            signal: abortController.signal,
          });
          abortController.signal.throwIfAborted();

          const archive = await parsePptxZip(buffer, abortController.signal);
          const slideXmls = sortSlides(archive.slides);

          try {
            const semantic = await readPptxSemanticDeck(
              archive.presentation,
              slideXmls,
              abortController.signal,
            );
            if (semantic.slides.length > 0 && !disposed) {
              setSemanticDeck(semantic);
            }
          } catch { /* best-effort */ }

          const pptxInsight = await readPptxInsight(
            slideXmls,
            abortController.signal,
          );
          if (pptxInsight.slideCount > 0 && !disposed) {
            setInsight(pptxInsight);
          }
        } catch {
          // bare error state is fine
        }
      }
    }

    void mountViewer();

    return () => {
      disposed = true;
      abortController.abort();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      contentRef.current?.replaceChildren();
    };
  }, [source]);

  // Apply zoom prop changes to the existing viewer without re-parsing.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setZoomState(defaultZoom);
    void viewer.setZoom(defaultZoom);
  }, [defaultZoom]);

  // View mode switching — never depends on state.status. Mode buttons are
  // disabled while not ready, so this effect is only triggered by real user
  // intent after the viewer is mounted.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const operationId = ++modeOperationRef.current;
    const targetIndex = viewer.currentSlideIndex;

    setIsModeSwitching(true);

    void (async () => {
      try {
        if (viewMode === "grid") {
          await viewer.renderList({
            windowed: true,
            initialSlides: 4,
            batchSize: 4,
            overscanViewport: 1.5,
          });

          if (operationId !== modeOperationRef.current) return;

          await viewer.goToSlide(targetIndex, { block: "center" });
        } else {
          await viewer.renderSlide(targetIndex);
        }
      } catch (error) {
        if (operationId === modeOperationRef.current) {
          callbacksRef.current.onError?.(
            error instanceof Error
              ? error
              : new Error("Failed to switch PPTX view mode"),
          );
        }
      } finally {
        if (operationId === modeOperationRef.current) {
          setIsModeSwitching(false);
        }
      }
    })();

    return () => {
      modeOperationRef.current += 1;
    };
  }, [viewMode]);

  const slideCount = state.status === "ready" ? state.slideCount : 0;

  const goToSlide = useCallback(
    async (index: number) => {
      const viewer = viewerRef.current;
      if (!viewer || state.status !== "ready") return;

      const nextIndex = Math.min(slideCount - 1, Math.max(0, index));
      await viewer.goToSlide(nextIndex, { behavior: "smooth", block: "center" });
    },
    [state.status, slideCount],
  );

  const nextSlide = useCallback(() => {
    void goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    void goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const zoomOut = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = Math.max(zoomMin, zoom - PPTX_ZOOM_STEP);
    setZoomState(next);
    void viewer.setZoom(next);
  }, [zoom, zoomMin]);

  const zoomIn = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = Math.min(zoomMax, zoom + PPTX_ZOOM_STEP);
    setZoomState(next);
    void viewer.setZoom(next);
  }, [zoom, zoomMax]);

  const resetZoom = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setZoomState(defaultZoom);
    void viewer.setZoom(defaultZoom);
  }, [defaultZoom]);

  const switchViewMode = useCallback((mode: PptxViewMode) => {
    setViewMode(mode);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el =
      scrollContainerRef.current?.closest("[data-preview-container]") ||
      scrollContainerRef.current;
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

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (viewMode !== "slide" || state.status !== "ready" || isModeSwitching) return;

      const target = event.target as HTMLElement;
      if (
        target.matches(
          "input, textarea, select, button, [contenteditable='true']",
        )
      ) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        prevSlide();
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        nextSlide();
      }
    },
    [viewMode, state.status, isModeSwitching, prevSlide, nextSlide],
  );

  if (ext === "ppt") {
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">{t.formatNotSupported}</p>
        <p className="fv-pptx__error-msg">{t.legacyPptDesc}</p>
      </div>
    );
  }

  if (state.status === "error") {
    if (semanticDeck) {
      return <PptxSemanticFallback deck={semanticDeck} error={new Error(state.message)} />;
    }
    if (insight) {
      return <PptxSummaryFallback insight={insight} error={new Error(state.message)} />;
    }
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">{t.previewFailed}</p>
        <p className="fv-pptx__error-msg">{state.message}</p>
      </div>
    );
  }

  return (
    <div
      className="fv-pptx"
      data-preview-container
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="fv-pptx__toolbar">
        <div className="fv-pptx__toolbar-left">
          {viewMode === "slide" ? (
            <>
              <span className="fv-pptx__slide-count">
                {slideCount > 0 ? `${currentSlide + 1} / ${slideCount}` : "— / —"}
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
          <button
            type="button"
            disabled={state.status !== "ready" || isModeSwitching}
            onClick={() => switchViewMode("slide")}
            className={`fv-pptx__mode-btn ${viewMode === "slide" ? "fv-pptx__mode-btn--active" : ""}`}
            title={t.slideView}
          >
            <MonitorIcon size={16} />
          </button>
          <button
            type="button"
            disabled={state.status !== "ready" || isModeSwitching}
            onClick={() => switchViewMode("grid")}
            className={`fv-pptx__mode-btn ${viewMode === "grid" ? "fv-pptx__mode-btn--active" : ""}`}
            title={t.gridView}
          >
            <Grid3X3Icon size={16} />
          </button>

          <div className="fv-toolbar__separator" />

          <div className="fv-pptx__zoom-group">
            <button type="button" onClick={zoomOut} className="fv-pptx__zoom-btn" title={t.zoomOut}>
              <ZoomOutIcon size={14} />
            </button>
            <button type="button" onClick={resetZoom} className="fv-pptx__zoom-label" title="Reset zoom">
              {zoom}%
            </button>
            <button type="button" onClick={zoomIn} className="fv-pptx__zoom-btn" title={t.zoomIn}>
              <ZoomInIcon size={14} />
            </button>
          </div>

          <button type="button" onClick={toggleFullscreen} className="fv-pptx__fullscreen-btn" title={t.fullscreen}>
            {isFullscreen ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
          </button>
        </div>

        {viewMode === "slide" && (
          <div className="fv-pptx__nav">
            <button
              type="button"
              onClick={prevSlide}
              disabled={state.status !== "ready" || currentSlide === 0}
              className="fv-pptx__nav-btn"
              title={t.previousPage}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              disabled={state.status !== "ready" || currentSlide >= slideCount - 1}
              className="fv-pptx__nav-btn"
              title={t.nextPage}
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div ref={scrollContainerRef} className="fv-pptx__content">
        {state.status === "loading" && (
          <div className="fv-pptx__loading-overlay">
            <div className="fv-spinner fv-spinner--lg" />
            <p className="fv-pptx__loading-label">{t.loadingPresentation}</p>
          </div>
        )}

        <div
          className={
            viewMode === "slide"
              ? "fv-pptx__slide-wrap"
              : "fv-pptx__grid-wrap"
          }
        >
          <div ref={contentRef} className="fv-pptx__render-container" />
        </div>
      </div>
    </div>
  );
}
