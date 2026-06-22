"use client";

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
import { orderSlidesByPresentation } from "./pptx/order-slides";
import { safelyInvoke } from "./pptx/safely-invoke";
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

const isDevelopment =
  typeof process !== "undefined" &&
  typeof process.env !== "undefined" &&
  process.env.NODE_ENV !== "production";

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

  // Warn on invalid zoom bounds in development. We still self-correct via
  // Math.min/Math.max so a swapped pair won't break the UI. The warning
  // lives in an effect so each render does not duplicate the log.
  useEffect(() => {
    if (!isDevelopment) return;
    if (minZoom > maxZoom) {
      console.warn(
        `[PptxPreview] minZoom (${minZoom}) > maxZoom (${maxZoom}); zoom bounds will be auto-swapped.`,
      );
    }
  }, [minZoom, maxZoom]);

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
  // Tracks the DOM node we put into fullscreen. Other components on the page
  // (videos, images, a second PPTX) can put their own elements into
  // fullscreen too — without this ref we would flip our own UI state in
  // response to their events.
  const fullscreenTargetRef = useRef<Element | null>(null);

  const [viewMode, setViewMode] = useState<PptxViewMode>("slide");
  // Mirrors the viewer's actual rendering mode. `viewMode` reflects the
  // user's intent; `activeViewMode` reflects what the viewer has confirmed.
  // They diverge only briefly while a switch is in flight, and they always
  // converge after the switch resolves (or rolls back).
  const [activeViewMode, setActiveViewMode] = useState<PptxViewMode>("slide");
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

      // Read the source ONCE into an ArrayBuffer. The buffer is shared
      // between the high-fidelity viewer and the fallback paths — this
      // avoids a double fetch for URL sources when the viewer fails.
      let buffer: ArrayBuffer;
      try {
        buffer = await readSourceAsArrayBuffer(source, {
          signal: abortController.signal,
        });
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        const message = getErrorMessage(error);
        setState({ status: "error", message });
        safelyInvoke(callbacksRef.current.onError,
          error instanceof Error ? error : new Error(message));
        return;
      }

      if (disposed || abortController.signal.aborted) return;

      let viewerError: unknown = null;
      try {
        const viewer = await openPptxViewer({
          input: buffer,
          container,
          scrollContainer,
          renderMode: startViewMode === "grid" ? "list" : "slide",
          signal: abortController.signal,
          initialZoom: startInitialZoom,

          onSlideChange(index: number) {
            if (!disposed) {
              setCurrentSlide(index);
              safelyInvoke(callbacksRef.current.onSlideChange, index);
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
        setActiveViewMode(startViewMode);
        // Note: onReady is invoked via safelyInvoke so a consumer-thrown
        // error never trips the catch below and never triggers fallback.
        safelyInvoke(callbacksRef.current.onReady, readyInfo);
        return;
      } catch (error: unknown) {
        if (
          disposed ||
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        viewerError = error;
      }

      // High-fidelity viewer failed — try fallback using the same buffer.
      let fallbackSuccess = false;
      try {
        if (disposed || abortController.signal.aborted) return;

        const archive = await parsePptxZip(buffer, abortController.signal);
        if (disposed || abortController.signal.aborted) return;

        const slideXmls = orderSlidesByPresentation(
          archive.slides,
          archive.presentation,
          archive.presentationRels,
        );

        try {
          const semantic = await readPptxSemanticDeck(
            archive.presentation,
            slideXmls,
            abortController.signal,
          );
          if (semantic.slides.length > 0 && !disposed) {
            setSemanticDeck(semantic);
            fallbackSuccess = true;
          }
        } catch { /* best-effort */ }

        const pptxInsight = await readPptxInsight(
          slideXmls,
          abortController.signal,
        );
        if (pptxInsight.slideCount > 0 && !disposed) {
          setInsight(pptxInsight);
          fallbackSuccess = true;
        }
      } catch {
        // Fallback parsing failed (corrupted PPTX, abort, etc.). The error
        // is reported below via the original viewerError.
      }

      if (disposed) return;

      const message = getErrorMessage(viewerError);
      setState({ status: "error", message });

      // Surface the original PPTX rendering error to the consumer once,
      // AFTER the fallback attempt completes. We emit onError regardless
      // of whether the fallback produced a degraded view — the original
      // failure is still meaningful telemetry. Consumers that want to
      // distinguish "fully failed" from "degraded" can listen to setSemantic
      // / setInsight indirectly via the rendered fallback markup, or use
      // the future onDegraded hook (not yet exposed).
      safelyInvoke(callbacksRef.current.onError,
        viewerError instanceof Error
          ? viewerError
          : new Error(message));

      // Note: `fallbackSuccess` is currently unused at the callback layer.
      // Future enhancement: emit onDegraded(viewerError) when true, and
      // onError(viewerError) only when false.
      void fallbackSuccess;
    }

    void mountViewer();

    return () => {
      disposed = true;
      abortController.abort();
      modeOperationRef.current += 1;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      contentRef.current?.replaceChildren();
    };
  }, [source]);

  // Apply zoom prop changes to the existing viewer without re-parsing.
  // On failure the zoom state is rolled back to the viewer's actual value.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const prevZoom = viewer.zoomPercent ?? defaultZoom;
    setZoomState(defaultZoom);
    void viewer.setZoom(defaultZoom).catch(() => {
      setZoomState(prevZoom);
    });
  }, [defaultZoom]);

  // View mode switching — never depends on state.status. Mode buttons are
  // disabled while not ready, so this effect is only triggered by real user
  // intent after the viewer is mounted.
  //
  // On failure we roll back `viewMode` to the last known `activeViewMode`,
  // keeping the UI in sync with the viewer's actual rendering state.
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

        // Commit — the viewer has confirmed the new mode.
        if (operationId === modeOperationRef.current) {
          setActiveViewMode(viewMode);
        }
      } catch (error) {
        if (operationId === modeOperationRef.current) {
          // Roll back the requested mode to the last known active mode.
          setViewMode(activeViewMode);

          safelyInvoke(callbacksRef.current.onError,
            error instanceof Error
              ? error
              : new Error("Failed to switch PPTX view mode"));
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
  }, [viewMode, activeViewMode]);

  const slideCount = state.status === "ready" ? state.slideCount : 0;

  const goToSlide = useCallback(
    async (index: number) => {
      const viewer = viewerRef.current;
      if (!viewer || state.status !== "ready") return;

      const nextIndex = Math.min(slideCount - 1, Math.max(0, index));
      try {
        await viewer.goToSlide(nextIndex, { behavior: "smooth", block: "center" });
      } catch {
        // Navigate failure is non-fatal — viewer stays in a usable state.
      }
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
    const prev = zoom;
    const next = Math.max(zoomMin, zoom - PPTX_ZOOM_STEP);
    setZoomState(next);
    void viewer.setZoom(next).catch(() => {
      setZoomState(prev);
    });
  }, [zoom, zoomMin]);

  const zoomIn = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const prev = zoom;
    const next = Math.min(zoomMax, zoom + PPTX_ZOOM_STEP);
    setZoomState(next);
    void viewer.setZoom(next).catch(() => {
      setZoomState(prev);
    });
  }, [zoom, zoomMax]);

  const resetZoom = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const prev = zoom;
    setZoomState(defaultZoom);
    void viewer.setZoom(defaultZoom).catch(() => {
      setZoomState(prev);
    });
  }, [zoom, defaultZoom]);

  const switchViewMode = useCallback((mode: PptxViewMode) => {
    setViewMode(mode);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el =
      scrollContainerRef.current?.closest("[data-preview-container]") ||
      scrollContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      fullscreenTargetRef.current = el;
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          fullscreenTargetRef.current = null;
        });
    } else {
      document.exitFullscreen()
        .then(() => {
          fullscreenTargetRef.current = null;
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(
        document.fullscreenElement === fullscreenTargetRef.current,
      );
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeViewMode !== "slide" || state.status !== "ready" || isModeSwitching) return;

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
    [activeViewMode, state.status, isModeSwitching, prevSlide, nextSlide],
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
            activeViewMode === "slide"
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
