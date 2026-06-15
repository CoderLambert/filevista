
import {
  useEffect,
  useRef,
  useState,
  useCallback,
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
import "./styles/PptxPreview.css";

interface PptxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
}

type ViewMode = "slide" | "grid";

/**
 * Lightweight post-render: silently replace images that browsers can't display
 * (e.g. EMF/WMF) with a barely-visible dotted-border placeholder instead of
 * the default broken-image icon.
 */
const UNSUPPORTED_IMG_FORMATS = ["image/x-emf", "image/x-wmf", "image/emf", "image/wmf"];

function hideBrokenImages(container: HTMLElement) {
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.src || "";
    const isUnsupported = UNSUPPORTED_IMG_FORMATS.some(
      (fmt) => src.startsWith(`data:${fmt}`) || src.includes(fmt.replace("/", "/"))
    );
    if (isUnsupported) {
      // Replace with a subtle transparent 1px placeholder
      img.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
      img.style.opacity = "0.15";
      img.style.background = "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 0 0 / 8px 8px";
    }
  });
}

// Lazy-load pptx-preview to avoid SSR issues
let pptxPreviewModule: typeof import("pptx-preview") | null = null;
async function getPptxPreview() {
  if (!pptxPreviewModule) {
    pptxPreviewModule = await import("pptx-preview");
  }
  return pptxPreviewModule;
}

export interface PptxRenderHandle {
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
}

// Inner component that re-mounts on content/mode changes (avoids setState-in-effect lint issue)
const PptxRenderContainer = forwardRef<
  PptxRenderHandle,
  {
    content?: string | null;
    source?: PreviewSource;
    mode: ViewMode;
    zoom: number;
    onReady: (info: { slideCount: number; currentIndex: number }) => void;
    onError: (error: string) => void;
  }
>(function PptxRenderContainer(
  { content, source, mode, zoom, onReady, onError },
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
    if (!containerRef.current) return;
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;

      // Destroy previous viewer
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {
          // ignore
        }

        viewerRef.current = null;
      }

      containerRef.current.innerHTML = "";

      try {
        const { init } = await getPptxPreview();
        if (cancelled || !containerRef.current) return;

        const viewer = init(containerRef.current, {
          width: 960,
          height: 540,
          mode: mode === "grid" ? "list" : "slide",
        });

        viewerRef.current = viewer;

        const buffer = await readBinaryPreviewAsArrayBuffer({ source, content });

        if (cancelled) return;

        // Use preview() for simpler flow (load + render in one call)
        await viewer.preview(buffer);
        if (cancelled) return;

        const pptx = viewer.pptx;
        const count = pptx?.slides?.length || viewer.slideCount || 0;
        const idx = viewer.currentIndex || 0;
        slideCountRef.current = count;

        onReady({ slideCount: count, currentIndex: idx });

        // Post-render: hide broken images & library navigation
        try {
          if (containerRef.current) {
            hideBrokenImages(containerRef.current);

            // Hide built-in navigation elements rendered by the library
            const navElements = containerRef.current.querySelectorAll(
              ".pre-btn, .next-btn, .pagination, [class*='pre-btn'], [class*='next-btn'], [class*='pagination'], button"
            );
            navElements.forEach((el) => {
              (el as HTMLElement).style.display = "none";
            });
          }
        } catch {}
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error
              ? err.message
              : "PPTX 预览失败，文件可能已损坏或格式不受支持"
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
  }, [content, source, mode, onReady, onError]);

  return (
    <div
      style={{
        zoom: zoom / 100,
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <div
        ref={containerRef}
        className="fv-pptx__render-container"
        style={{
          minWidth: mode === "slide" ? 960 : undefined,
          minHeight: mode === "slide" ? 540 : undefined,
        }}
      />
    </div>
  );
});

export function PptxPreview({ content, source, fileName }: PptxPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("slide");
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const renderHandleRef = useRef<PptxRenderHandle>(null);

  // Stable callbacks for PptxRenderContainer
  const handleReady = useCallback(
    (info: { slideCount: number; currentIndex: number }) => {
      setSlideCount(info.slideCount);
      setCurrentSlide(info.currentIndex);
      setLoading(false);
      setError(null);
    },
    []
  );

  const handleError = useCallback((errMessage: string) => {
    setError(errMessage);
    setLoading(false);
  }, []);

  // Handle view mode switch
  const switchViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setLoading(true);
    setError(null);
    setRenderKey((k) => k + 1);
  }, []);

  // Navigation
  const goToSlide = useCallback(
    (index: number) => {
      if (viewMode !== "slide") return;
      const clamped = Math.max(0, Math.min(index, slideCount - 1));
      renderHandleRef.current?.goToSlide(clamped);
      setCurrentSlide(clamped);
    },
    [slideCount, viewMode]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

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

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const el = document.querySelector("[data-preview-container]");
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Detect .ppt files early
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "ppt") {
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">格式不支持</p>
        <p className="fv-pptx__error-msg">
          该文件为旧版 PowerPoint 二进制格式（.ppt），当前仅支持 Open XML
          格式（.pptx）。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 格式后重试。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">预览失败</p>
        <p className="fv-pptx__error-msg">
          {error}
        </p>
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
              <span className="fv-pptx__slide-label">页</span>
            </>
          ) : (
            <>
              <span className="fv-pptx__slide-count">
                {slideCount}
              </span>
              <span className="fv-pptx__slide-label">页</span>
            </>
          )}
        </div>

        <div className="fv-pptx__toolbar-right">
          {/* View mode toggle */}
          <button
            onClick={() => switchViewMode("slide")}
            className={`fv-pptx__mode-btn ${viewMode === "slide" ? "fv-pptx__mode-btn--active" : ""}`}
            title="幻灯片视图"
          >
            <MonitorIcon size={16} />
          </button>
          <button
            onClick={() => switchViewMode("grid")}
            className={`fv-pptx__mode-btn ${viewMode === "grid" ? "fv-pptx__mode-btn--active" : ""}`}
            title="缩略图视图"
          >
            <Grid3X3Icon size={16} />
          </button>

          <div className="fv-toolbar__separator" />

          {/* Zoom controls */}
          <div className="fv-pptx__zoom-group">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="fv-pptx__zoom-btn"
              title="缩小"
            >
              <ZoomOutIcon size={14} />
            </button>
            <span className="fv-pptx__zoom-label">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="fv-pptx__zoom-btn"
              title="放大"
            >
              <ZoomInIcon size={14} />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="fv-pptx__fullscreen-btn"
            title="全屏"
          >
            {isFullscreen ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
          </button>
        </div>

        {viewMode === "slide" && (
          <div className="fv-pptx__nav">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0 || loading}
              className="fv-pptx__nav-btn"
              title="上一页 (←)"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide >= slideCount - 1 || loading}
              className="fv-pptx__nav-btn"
              title="下一页 (→)"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="fv-pptx__content">
        {loading && (
          <div className="fv-pptx__loading-overlay">
            <div className="fv-spinner fv-spinner--lg" />
            <p className="fv-pptx__loading-label">
              正在解析演示文稿...
            </p>
          </div>
        )}

        <div className={viewMode === "slide" ? "fv-pptx__slide-wrap" : "fv-pptx__grid-wrap"}>
          <PptxRenderContainer
            key={renderKey}
            ref={renderHandleRef}
            content={content}
            source={source}
            mode={viewMode}
            zoom={zoom}
            onReady={handleReady}
            onError={handleError}
          />
        </div>
      </div>
    </div>
  );
}
