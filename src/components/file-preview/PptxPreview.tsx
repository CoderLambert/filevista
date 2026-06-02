"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Monitor,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { base64ToUint8Array } from "./utils";

interface PptxPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

type ViewMode = "slide" | "grid";

// ---- EMF/WMF Image Patch ----
// Browsers cannot render EMF/WMF images in <img> tags.
// pptx-preview loads them as data:image/x-emf;base64,... which results in broken images.
// We patch the viewer's media store to replace unsupported formats with SVG placeholders.

const UNSUPPORTED_IMG_FORMATS = ["image/x-emf", "image/x-wmf", "image/emf", "image/wmf"];

function createImagePlaceholderSvg(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="4" fill="#e5e7eb" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui,sans-serif" font-size="12">EMF 图片</text>
    <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui,sans-serif" font-size="10">浏览器暂不支持</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

/**
 * Patch the pptx-preview viewer's media store: replace EMF/WMF data URLs
 * with SVG placeholders so they render as "unsupported format" indicators
 * instead of broken image icons.
 */
function patchUnsupportedImages(viewer: any) {
  if (!viewer?.pptx?.medias) return;
  const medias = viewer.pptx.medias;
  for (const key of Object.keys(medias)) {
    const value: string = medias[key];
    if (typeof value !== "string") continue;
    const isUnsupported = UNSUPPORTED_IMG_FORMATS.some((fmt) =>
      value.startsWith(`data:${fmt}`)
    );
    if (isUnsupported) {
      medias[key] = createImagePlaceholderSvg(200, 150);
    }
  }
}

/**
 * Post-render scan: find any <img> elements in the container that failed to load
 * (e.g., EMF/WMF images that were already rendered before patching) and replace
 * them with placeholder elements.
 */
function fixBrokenImages(container: HTMLElement) {
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.src || "";
    const isUnsupported = UNSUPPORTED_IMG_FORMATS.some(
      (fmt) => src.startsWith(`data:${fmt}`) || src.includes(fmt.replace("/", "/"))
    );
    if (isUnsupported) {
      img.src = createImagePlaceholderSvg(200, 150);
      img.style.objectFit = "contain";
      img.style.background = "#f3f4f6";
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
    content: string;
    mode: ViewMode;
    zoom: number;
    onReady: (info: { slideCount: number; currentIndex: number }) => void;
    onError: (error: string) => void;
  }
>(function PptxRenderContainer(
  { content, mode, zoom, onReady, onError },
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
          viewerRef.current.destroy();
        } catch {}
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

        const bytes = base64ToUint8Array(content);
        const arrayBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        );

        if (cancelled) return;

        // Use load() instead of preview() so we can patch EMF/WMF images
        // BEFORE the library renders slides to DOM.
        // preview() is atomic (loads + renders in one call), but load() only
        // parses the file, allowing us to patch the media store in between.
        await viewer.load(arrayBuffer);
        if (cancelled) return;

        // Patch EMF/WMF images in the media store BEFORE rendering.
        // The library stores media as data URLs. EMF/WMF formats like
        // data:image/x-emf;base64,... can't be rendered by browsers,
        // so we replace them with SVG placeholders.
        patchUnsupportedImages(viewer);

        // Now manually render slides (what preview() would have done)
        const pptx = viewer.pptx;
        if (mode === "slide") {
          viewer.currentIndex = 0;
          viewer.htmlRender.renderSlide(0);
        } else {
          for (let i = 0; i < pptx.slides.length; i++) {
            viewer.htmlRender.renderSlide(i);
          }
        }

        const count = pptx.slides?.length || viewer.slideCount || 0;
        const idx = viewer.currentIndex || 0;
        slideCountRef.current = count;

        onReady({ slideCount: count, currentIndex: idx });

        // Post-render fixes
        try {
          if (containerRef.current) {
            // Fix any remaining broken images that slipped through
            fixBrokenImages(containerRef.current);

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
          viewerRef.current.destroy();
        } catch {}
        viewerRef.current = null;
      }
    };
  }, [content, mode, onReady, onError]);

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
        className="pptx-render-container shadow-lg rounded-lg overflow-hidden bg-white"
        style={{
          minWidth: mode === "slide" ? 960 : undefined,
          minHeight: mode === "slide" ? 540 : undefined,
        }}
      />
    </div>
  );
});

export function PptxPreview({ content, fileName }: PptxPreviewProps) {
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
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3 px-6">
        <AlertTriangle size={36} />
        <p className="text-lg font-medium">格式不支持</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          该文件为旧版 PowerPoint 二进制格式（.ppt），当前仅支持 Open XML
          格式（.pptx）。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 格式后重试。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3 px-6">
        <AlertTriangle size={36} />
        <p className="text-lg font-medium">预览失败</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-preview-container>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {viewMode === "slide" ? (
            <>
              <span className="text-sm font-medium tabular-nums">
                {currentSlide + 1} / {slideCount}
              </span>
              <span className="text-xs text-muted-foreground">页</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium tabular-nums">
                {slideCount}
              </span>
              <span className="text-xs text-muted-foreground">页</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <button
            onClick={() => switchViewMode("slide")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "slide"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="幻灯片视图"
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => switchViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "grid"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title="缩略图视图"
          >
            <Grid3X3 size={16} />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 border rounded-md px-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="缩小"
            >
              <ZoomOut size={14} className="text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center select-none">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="放大"
            >
              <ZoomIn size={14} className="text-muted-foreground" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="全屏"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {viewMode === "slide" && (
          <div className="flex items-center gap-1">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0 || loading}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="上一页 (←)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlide >= slideCount - 1 || loading}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="下一页 (→)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto bg-gray-100 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 z-10 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground text-sm">
              正在解析演示文稿...
            </p>
          </div>
        )}

        <div
          className={
            viewMode === "slide"
              ? "flex items-center justify-center p-4 md:p-8 min-h-full"
              : "p-4 md:p-6"
          }
        >
          <PptxRenderContainer
            key={renderKey}
            ref={renderHandleRef}
            content={content}
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
