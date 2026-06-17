# FileVista PPTX 预览稳定适配方案实现文档

## 1. 背景

当前 `file-preview` 的 PPTX 预览基于 `pptx-preview` 实现。整体方案能正常解析并渲染 PPTX 文件，但在真实业务页面中会出现以下问题：

1. 幻灯片只显示局部。
2. 幻灯片内部出现横向或纵向滚动条。
3. 表格、文字、图片被裁切。
4. 缩放不稳定。
5. 不同容器宽高下展示效果不一致。
6. 日文、中文等 CJK PPT 字体还原不稳定。
7. `.pptx` 渲染失败后缺少结构化 fallback。

这些问题的根因不是单纯的 PPTX 解析失败，而是当前预览组件缺少稳定的 `fit-to-container` 适配体系。

本方案目标是将 PPTX 预览从：

```txt
固定 960 × 540 + CSS zoom + 外层滚动
```

改造为：

```txt
统一 viewport
  ↓
自动计算 fitScale
  ↓
stage 占位
  ↓
transform scale 缩放
  ↓
pptx-preview 固定基准尺寸渲染
  ↓
失败时 summary fallback
```

---

# 2. 改造目标

## 2.1 核心目标

本次改造要解决：

```txt
1. PPTX 页面完整显示
2. 默认 fit=contain，自适应容器
3. 不再使用 CSS zoom
4. 避免内外嵌套滚动条
5. 支持用户缩放
6. 支持全屏后重新计算尺寸
7. 支持 ResizeObserver 响应式更新
8. 支持 PPTX 高保真渲染失败后的基础内容 fallback
```

## 2.2 不追求的目标

本方案不承诺：

```txt
1. 和 PowerPoint 完全一致
2. 播放动画
3. 完整还原复杂母版
4. 完整还原 SmartArt
5. 完整还原音视频嵌入
6. 完整还原所有 Office 字体度量
7. 支持旧版 .ppt 高保真预览
```

PPTX 浏览器预览的定位应该是：

```txt
尽可能展示内容和基础版式，不等同于 PowerPoint/WPS 的完整渲染引擎。
```

---

# 3. 当前问题分析

## 3.1 固定尺寸问题

当前 `pptx-preview` 初始化大致是：

```ts
const viewer = init(containerRef.current, {
  width: 960,
  height: 540,
  mode: mode === "grid" ? "list" : "slide",
});
```

这意味着渲染器默认认为幻灯片是 16:9，尺寸是 `960 × 540`。

问题是，真实预览区域可能是：

```txt
1. 左侧有文件列表
2. 顶部有 toolbar
3. 外层有 padding
4. 容器高度不足
5. 浏览器窗口宽高变化
6. 全屏前后尺寸变化
7. PPT 原始比例不一定是 16:9
```

如果不根据真实容器尺寸计算适配比例，固定尺寸就会撑破容器或被裁切。

## 3.2 CSS zoom 问题

当前外层使用类似：

```tsx
<div
  style={{
    zoom: zoom / 100,
    maxWidth: "100%",
    overflow: "hidden",
  }}
>
  <div ref={containerRef} />
</div>
```

`zoom` 的问题：

```txt
1. 非标准布局缩放方案
2. 会影响滚动区域计算
3. 和内部固定尺寸 DOM 容易冲突
4. 容易产生嵌套滚动条
5. 不利于 Firefox 等浏览器兼容
```

应该改为：

```txt
外层 stage 真实占位
内层 transform: scale(...)
```

## 3.3 overflow 问题

当前结构中可能存在多层滚动：

```txt
.fv-pptx__content       overflow: auto
.fv-pptx__slide-wrap    flex 居中 + padding
.fv-pptx__render-container overflow: hidden
pptx-preview 内部元素 可能有 overflow auto/scroll
```

这会导致：

```txt
外层能滚
内层也能滚
幻灯片自己也可能出现滚动条
```

稳定方案应该是：

```txt
slide 模式：
  外层 content 可以滚动
  单页 stage 不应出现内部滚动条
  pptx-preview 内部 slide 容器强制 overflow hidden

grid/list 模式：
  外层 content 滚动
  每一页 slide 可以作为缩略页纵向排列
```

---

# 4. 目标架构

## 4.1 组件结构

建议将 PPTX 预览拆为以下层级：

```txt
PptxPreview
  ├─ PptxToolbar
  ├─ PptxViewport
  │   └─ PptxRenderContainer
  │       └─ PptxStage
  │           └─ PptxScaleLayer
  │               └─ pptx-preview container
  └─ PptxSummaryFallback
```

## 4.2 文件结构

建议新增或调整：

```txt
packages/file-preview/src/
  PptxPreview.tsx
  PptxToolbar.tsx
  PptxRenderContainer.tsx
  PptxSummaryFallback.tsx

  pptx/
    types.ts
    constants.ts
    usePptxFitScale.ts
    read-pptx-insight.ts
    pptx-renderer.ts

  styles/
    PptxPreview.css
```

也可以第一阶段不拆太细，先在 `PptxPreview.tsx` 内完成稳定适配，再逐步拆文件。

---

# 5. 类型设计

新建：

```ts
// packages/file-preview/src/pptx/types.ts

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
```

---

# 6. 常量设计

```ts
// packages/file-preview/src/pptx/constants.ts

export const PPTX_BASE_WIDTH = 960;
export const PPTX_BASE_HEIGHT = 540;

export const PPTX_MIN_ZOOM = 50;
export const PPTX_MAX_ZOOM = 200;
export const PPTX_ZOOM_STEP = 10;

export const PPTX_STAGE_PADDING = 32;
```

说明：

```txt
PPTX_BASE_WIDTH / PPTX_BASE_HEIGHT 是渲染基准尺寸。
fitScale 根据容器尺寸计算。
userZoom 是用户缩放。
displayScale = fitScale * userZoom / 100。
```

---

# 7. fitScale 计算方案

## 7.1 计算规则

```ts
function calculateFitScale(input: {
  fit: PptxFitMode;
  viewportWidth: number;
  viewportHeight: number;
  baseWidth: number;
  baseHeight: number;
}) {
  const { fit, viewportWidth, viewportHeight, baseWidth, baseHeight } = input;

  const widthScale = viewportWidth / baseWidth;
  const heightScale = viewportHeight / baseHeight;

  switch (fit) {
    case "contain":
      return Math.min(widthScale, heightScale);

    case "cover":
      return Math.max(widthScale, heightScale);

    case "width":
      return widthScale;

    case "height":
      return heightScale;

    case "actual":
      return 1;

    case "scale-down":
      return Math.min(1, Math.min(widthScale, heightScale));

    default:
      return Math.min(widthScale, heightScale);
  }
}
```

## 7.2 稳定性保护

```ts
function normalizeScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(0.05, Math.min(scale, 5));
}
```

## 7.3 displayScale

```ts
const displayScale = normalizeScale(fitScale * (userZoom / 100));
```

---

# 8. usePptxFitScale Hook

```ts
// packages/file-preview/src/pptx/usePptxFitScale.ts

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { PptxFitMode, PptxFitState } from "./types";
import {
  PPTX_BASE_WIDTH,
  PPTX_BASE_HEIGHT,
  PPTX_STAGE_PADDING,
} from "./constants";

function calculateFitScale(input: {
  fit: PptxFitMode;
  viewportWidth: number;
  viewportHeight: number;
  baseWidth: number;
  baseHeight: number;
}) {
  const { fit, viewportWidth, viewportHeight, baseWidth, baseHeight } = input;

  const widthScale = viewportWidth / baseWidth;
  const heightScale = viewportHeight / baseHeight;

  switch (fit) {
    case "contain":
      return Math.min(widthScale, heightScale);
    case "cover":
      return Math.max(widthScale, heightScale);
    case "width":
      return widthScale;
    case "height":
      return heightScale;
    case "actual":
      return 1;
    case "scale-down":
      return Math.min(1, Math.min(widthScale, heightScale));
    default:
      return Math.min(widthScale, heightScale);
  }
}

function normalizeScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(0.05, Math.min(scale, 5));
}

export function usePptxFitScale(input: {
  viewportRef: RefObject<HTMLElement | null>;
  fit: PptxFitMode;
  userZoom: number;
  baseWidth?: number;
  baseHeight?: number;
  padding?: number;
}): PptxFitState {
  const {
    viewportRef,
    fit,
    userZoom,
    baseWidth = PPTX_BASE_WIDTH,
    baseHeight = PPTX_BASE_HEIGHT,
    padding = PPTX_STAGE_PADDING,
  } = input;

  const [size, setSize] = useState({
    viewportWidth: baseWidth,
    viewportHeight: baseHeight,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();

      const viewportWidth = Math.max(1, rect.width - padding);
      const viewportHeight = Math.max(1, rect.height - padding);

      setSize({
        viewportWidth,
        viewportHeight,
      });
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, [viewportRef, padding]);

  return useMemo(() => {
    const fitScale = normalizeScale(
      calculateFitScale({
        fit,
        viewportWidth: size.viewportWidth,
        viewportHeight: size.viewportHeight,
        baseWidth,
        baseHeight,
      })
    );

    const displayScale = normalizeScale(fitScale * (userZoom / 100));

    return {
      viewportWidth: size.viewportWidth,
      viewportHeight: size.viewportHeight,
      baseWidth,
      baseHeight,
      fitScale,
      userZoom,
      displayScale,
      stageWidth: baseWidth * displayScale,
      stageHeight: baseHeight * displayScale,
    };
  }, [size, fit, userZoom, baseWidth, baseHeight]);
}
```

---

# 9. PptxRenderContainer 实现

## 9.1 改造目标

从：

```tsx
<div style={{ zoom: zoom / 100 }}>
  <div ref={containerRef} />
</div>
```

改为：

```tsx
<div className="fv-pptx__stage">
  <div className="fv-pptx__scale-layer">
    <div ref={containerRef} className="fv-pptx__render-container" />
  </div>
</div>
```

## 9.2 参考实现

```tsx
// packages/file-preview/src/PptxRenderContainer.tsx

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { readBinaryPreviewAsArrayBuffer } from "./core/binary";
import type { PreviewSource } from "./core/types";
import type {
  PptxRenderHandle,
  PptxReadyInfo,
  PptxViewMode,
} from "./pptx/types";
import {
  PPTX_BASE_WIDTH,
  PPTX_BASE_HEIGHT,
} from "./pptx/constants";

let pptxPreviewModule: typeof import("pptx-preview") | null = null;

async function getPptxPreview() {
  if (!pptxPreviewModule) {
    pptxPreviewModule = await import("pptx-preview");
  }
  return pptxPreviewModule;
}

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

    if (!isUnsupported) return;

    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
    img.style.opacity = "0.15";
    img.style.background =
      "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 0 0 / 8px 8px";
  });
}

function cleanupPptxPreviewDom(container: HTMLElement, mode: PptxViewMode) {
  hideBrokenImages(container);

  const navElements = container.querySelectorAll(
    ".pre-btn, .next-btn, .pagination, [class*='pre-btn'], [class*='next-btn'], [class*='pagination']"
  );

  navElements.forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });

  if (mode === "slide") {
    const candidates = container.querySelectorAll<HTMLElement>(
      "*"
    );

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

export interface PptxRenderContainerProps {
  content?: string | null;
  source?: PreviewSource;
  mode: PptxViewMode;
  scale: number;
  baseWidth?: number;
  baseHeight?: number;
  onReady: (info: PptxReadyInfo) => void;
  onError: (error: Error) => void;
}

export const PptxRenderContainer = forwardRef<
  PptxRenderHandle,
  PptxRenderContainerProps
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

        const clamped = Math.max(
          0,
          Math.min(index, slideCountRef.current - 1)
        );

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

      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch {}
        viewerRef.current = null;
      }

      container.innerHTML = "";

      try {
        const { init } = await getPptxPreview();

        if (cancelled || !containerRef.current) return;

        const viewer = init(containerRef.current, {
          width: baseWidth,
          height: baseHeight,
          mode: mode === "grid" ? "list" : "slide",
        });

        viewerRef.current = viewer;

        const buffer = await readBinaryPreviewAsArrayBuffer({
          source,
          content,
        });

        if (cancelled) return;

        await viewer.preview(buffer);

        if (cancelled) return;

        const pptx = viewer.pptx;
        const count = pptx?.slides?.length || viewer.slideCount || 0;
        const idx = viewer.currentIndex || 0;

        slideCountRef.current = count;

        if (containerRef.current) {
          cleanupPptxPreviewDom(containerRef.current, mode);
        }

        onReady({
          slideCount: count,
          currentIndex: idx,
        });
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
        } catch {}
        viewerRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [
    content,
    source,
    mode,
    baseWidth,
    baseHeight,
    onReady,
    onError,
  ]);

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
```

---

# 10. PptxPreview 容器实现

```tsx
// packages/file-preview/src/PptxPreview.tsx

import {
  useCallback,
  useEffect,
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
import { useLocale } from "./core/i18n";
import { PptxRenderContainer } from "./PptxRenderContainer";
import { usePptxFitScale } from "./pptx/usePptxFitScale";
import type {
  PptxFitMode,
  PptxPreviewProps,
  PptxRenderHandle,
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
      onReady?.(info);
    },
    [onReady]
  );

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      setLoading(false);
      onError?.(err);
    },
    [onError]
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
    const el = viewportRef.current?.closest("[data-preview-container]") ||
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

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        setRenderKey((k) => k + 1);
      }, 50);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

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

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewMode, loading, prevSlide, nextSlide]);

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
    return (
      <div className="fv-pptx__error">
        <AlertTriangleIcon size={36} className="fv-pptx__error-icon" />
        <p className="fv-pptx__error-title">{t.previewFailed}</p>
        <p className="fv-pptx__error-msg">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="fv-pptx" data-preview-container>
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
              <span className="fv-pptx__slide-count">
                {slideCount}
              </span>
              <span className="fv-pptx__slide-label">{t.page}</span>
            </>
          )}
        </div>

        <div className="fv-pptx__toolbar-right">
          <button
            onClick={() => switchViewMode("slide")}
            className={`fv-pptx__mode-btn ${
              viewMode === "slide" ? "fv-pptx__mode-btn--active" : ""
            }`}
            title={t.slideView}
          >
            <MonitorIcon size={16} />
          </button>

          <button
            onClick={() => switchViewMode("grid")}
            className={`fv-pptx__mode-btn ${
              viewMode === "grid" ? "fv-pptx__mode-btn--active" : ""
            }`}
            title={t.gridView}
          >
            <Grid3X3Icon size={16} />
          </button>

          <div className="fv-toolbar__separator" />

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
```

---

# 11. CSS 稳定适配

替换或追加 `PptxPreview.css`：

```css
.fv-pptx {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Error / unsupported states */
.fv-pptx__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  height: 100%;
  min-height: 300px;
  gap: 0.75rem;
  padding: 0 1.5rem;

  color: var(--fv-danger);
}

.fv-pptx__error-icon {
  color: var(--fv-danger);
}

.fv-pptx__error-title {
  font-size: var(--fv-font-size-lg);
  font-weight: 500;
}

.fv-pptx__error-msg {
  max-width: 28rem;
  color: var(--fv-muted-foreground);
  font-size: var(--fv-font-size-sm);
  text-align: center;
}

/* Toolbar */
.fv-pptx__toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;

  min-width: 0;
  min-height: 42px;
  gap: 0.75rem;
  padding: 0.5rem 1rem;

  border-bottom: 1px solid var(--fv-border);
  background: color-mix(in srgb, var(--fv-muted) 30%, transparent);
}

.fv-pptx__toolbar-left,
.fv-pptx__toolbar-right,
.fv-pptx__nav {
  display: flex;
  align-items: center;
  min-width: 0;
}

.fv-pptx__toolbar-left {
  gap: 0.5rem;
}

.fv-pptx__toolbar-right {
  gap: 0.25rem;
}

.fv-pptx__nav {
  gap: 0.25rem;
}

.fv-pptx__slide-count {
  font-size: var(--fv-font-size-sm);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.fv-pptx__slide-label {
  color: var(--fv-muted-foreground);
  font-size: var(--fv-font-size-xs);
}

.fv-pptx__mode-btn,
.fv-pptx__zoom-btn,
.fv-pptx__fullscreen-btn,
.fv-pptx__nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  border: none;
  border-radius: var(--fv-radius);
  background: none;
  color: var(--fv-muted-foreground);

  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.fv-pptx__mode-btn,
.fv-pptx__fullscreen-btn,
.fv-pptx__nav-btn {
  padding: 0.375rem;
}

.fv-pptx__zoom-btn {
  padding: 0.25rem;
}

.fv-pptx__mode-btn:hover,
.fv-pptx__zoom-btn:hover,
.fv-pptx__fullscreen-btn:hover,
.fv-pptx__nav-btn:hover:not(:disabled) {
  background: var(--fv-muted);
  color: var(--fv-primary);
}

.fv-pptx__mode-btn--active {
  background: color-mix(in srgb, var(--fv-primary) 10%, transparent);
  color: var(--fv-primary);
}

.fv-pptx__nav-btn:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.fv-pptx__zoom-group {
  display: flex;
  align-items: center;

  gap: 0.125rem;
  padding: 0 0.25rem;

  border: 1px solid var(--fv-border);
  border-radius: var(--fv-radius);
}

.fv-pptx__zoom-label {
  width: 2.8rem;
  padding: 0.25rem 0;

  border: none;
  background: none;
  color: var(--fv-muted-foreground);

  font-size: var(--fv-font-size-xs);
  text-align: center;
  cursor: pointer;
  user-select: none;
}

/* Content */
.fv-pptx__content {
  position: relative;

  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;

  overflow: auto;
  background: var(--fv-canvas-bg);
}

/* Loading overlay */
.fv-pptx__loading-overlay {
  position: absolute;
  z-index: 10;
  inset: 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 0.75rem;
  background: color-mix(in srgb, var(--fv-canvas-bg) 80%, transparent);
}

.fv-pptx__loading-label {
  color: var(--fv-muted-foreground);
  font-size: var(--fv-font-size-sm);
}

/* Slide mode */
.fv-pptx__slide-wrap {
  display: flex;
  align-items: center;
  justify-content: center;

  min-width: 0;
  min-height: 100%;
  padding: 1rem;
}

@media (min-width: 768px) {
  .fv-pptx__slide-wrap {
    padding: 2rem;
  }
}

/* Grid mode */
.fv-pptx__grid-wrap {
  min-width: 0;
  padding: 1rem;
}

@media (min-width: 768px) {
  .fv-pptx__grid-wrap {
    padding: 1.5rem;
  }
}

/* Stage: real layout size after scale */
.fv-pptx__stage {
  position: relative;

  flex: 0 0 auto;
  overflow: hidden;

  background: #fff;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
}

/* Inner layer: original render size, scaled visually */
.fv-pptx__scale-layer {
  position: absolute;
  inset: 0 auto auto 0;

  transform-origin: top left;
  will-change: transform;
}

/* Actual pptx-preview container */
.fv-pptx__render-container {
  overflow: hidden !important;
  background: #fff;
  border-radius: 0;
  box-shadow: none;

  font-family:
    "Yu Gothic",
    "Meiryo",
    "Noto Sans JP",
    "Noto Sans CJK JP",
    "Noto Sans CJK SC",
    system-ui,
    sans-serif;
}

/* Slide mode: never allow internal scrollbars */
.fv-pptx__render-container--slide,
.fv-pptx__render-container--slide > *,
.fv-pptx__render-container--slide [class*="slide"],
.fv-pptx__render-container--slide [class*="page"],
.fv-pptx__render-container--slide [class*="container"],
.fv-pptx__render-container--slide [class*="wrapper"] {
  overflow: hidden !important;
}

/* Avoid broken layout from third-party buttons inside pptx-preview */
.fv-pptx__render-container--slide button,
.fv-pptx__render-container--slide [class*="pre-btn"],
.fv-pptx__render-container--slide [class*="next-btn"],
.fv-pptx__render-container--slide [class*="pagination"] {
  display: none !important;
}
```

---

# 12. Summary Fallback 方案

## 12.1 为什么需要 fallback

PPTX 高保真渲染失败时，不应该只显示：

```txt
Preview failed
```

更稳定的体验是：

```txt
高保真渲染失败
但仍然展示文件结构摘要：
  - 幻灯片数量
  - 每页提取出的文本
  - 图片数量
  - notes 数量
```

## 12.2 实现文件

```txt
packages/file-preview/src/pptx/read-pptx-insight.ts
packages/file-preview/src/PptxSummaryFallback.tsx
```

## 12.3 read-pptx-insight.ts 示例

```ts
import JSZip from "jszip";
import type { PptxInsight, PptxSlideInsight } from "./types";

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<a:t[^>]*>/g, "")
    .replace(/<\/a:t>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function extractTextFromSlideXml(xml: string): string[] {
  const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];

  return matches
    .map((match) =>
      match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    )
    .filter(Boolean);
}

function countMatches(xml: string, pattern: RegExp): number {
  return [...xml.matchAll(pattern)].length;
}

export async function readPptxInsight(
  arrayBuffer: ArrayBuffer
): Promise<PptxInsight> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const ai = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const bi = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return ai - bi;
    });

  const slides: PptxSlideInsight[] = [];
  let totalImages = 0;

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile)?.async("text");
    if (!xml) continue;

    const texts = extractTextFromSlideXml(xml);
    const imageCount = countMatches(xml, /<a:blip\b/g);

    totalImages += imageCount;

    slides.push({
      title: texts[0] || `Slide ${slides.length + 1}`,
      textCount: texts.length,
      imageCount,
      sampleTexts: texts.slice(0, 8),
    });
  }

  return {
    title: slides[0]?.title || "Presentation",
    slideCount: slides.length,
    imageCount: totalImages,
    slides,
  };
}
```

## 12.4 PptxSummaryFallback

```tsx
import type { PptxInsight } from "./pptx/types";

export function PptxSummaryFallback({
  insight,
  error,
}: {
  insight: PptxInsight;
  error?: Error | null;
}) {
  return (
    <div className="fv-pptx-summary">
      <div className="fv-pptx-summary__notice">
        <strong>高保真 PPTX 预览失败，已切换为基础内容预览。</strong>
        {error && <span>{error.message}</span>}
      </div>

      <div className="fv-pptx-summary__meta">
        <span>标题：{insight.title}</span>
        <span>幻灯片：{insight.slideCount}</span>
        <span>图片：{insight.imageCount}</span>
      </div>

      <div className="fv-pptx-summary__slides">
        {insight.slides.map((slide, index) => (
          <section key={index} className="fv-pptx-summary__slide">
            <h3>
              {index + 1}. {slide.title}
            </h3>

            <p>
              文本块：{slide.textCount}，图片：{slide.imageCount}
            </p>

            {slide.sampleTexts.length > 0 && (
              <ul>
                {slide.sampleTexts.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
```

---

# 13. 错误处理策略

PPTX 预览应该分三层：

```txt
第一层：pptx-preview 高保真渲染
第二层：PPTX XML summary fallback
第三层：无法解析时显示下载/不支持提示
```

推荐逻辑：

```ts
try {
  await renderHighFidelityPptx();
} catch (renderError) {
  try {
    const insight = await readPptxInsight(buffer);
    renderSummaryFallback(insight, renderError);
  } catch {
    renderUnsupportedFallback(renderError);
  }
}
```

---

# 14. `.ppt` 旧格式策略

旧版 `.ppt` 是二进制 Office 格式，不建议纯前端强行高保真解析。

策略：

```txt
.ppt:
  不进入 pptx-preview
  显示“不支持旧版 .ppt，请转换为 .pptx”
  提供下载原文件按钮
```

文案建议：

```txt
旧版 .ppt 是二进制 PowerPoint 格式，浏览器端无法稳定高保真预览。建议将文件另存为 .pptx 后重新上传。
```

---

# 15. 全屏适配策略

全屏后容器尺寸变化，需要重新计算 fitScale。

当前方案通过：

```txt
fullscreenchange
  ↓
setIsFullscreen
  ↓
ResizeObserver 自动更新尺寸
  ↓
必要时 setRenderKey 触发重新挂载
```

是否必须重新挂载？

```txt
普通尺寸变化：不需要重新挂载，只需要 scale 更新。
全屏切换后 pptx-preview 内部布局异常：可以延迟 50ms setRenderKey。
```

推荐保守实现：

```ts
useEffect(() => {
  function onFullscreenChange() {
    setIsFullscreen(!!document.fullscreenElement);

    window.setTimeout(() => {
      setRenderKey((k) => k + 1);
    }, 50);
  }

  document.addEventListener("fullscreenchange", onFullscreenChange);

  return () => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  };
}, []);
```

---

# 16. Grid/List 模式策略

`slide` 模式：

```txt
单页展示
fit contain
内部 overflow hidden
键盘左右切换
```

`grid` 模式：

```txt
列表展示
外层 content 允许滚动
不强制内部所有 overflow hidden
不使用单页居中 stage
可以把 scale 固定为 0.35 - 0.5
```

第一阶段可以简单处理：

```txt
grid 模式仍走 pptx-preview 的 list mode
不额外做复杂适配
```

后续如果 list mode 也不稳定，可以改成：

```txt
render 所有 slides
每页包一个 thumbnail frame
统一宽度
纵向滚动
```

---

# 17. 调试脚本

浏览器控制台调试：

```js
const root = document.querySelector(".fv-pptx__render-container");

console.log("render container", root?.getBoundingClientRect());

[...root.querySelectorAll("*")]
  .map((el) => ({
    el,
    className: el.className,
    rect: el.getBoundingClientRect(),
    overflow: getComputedStyle(el).overflow,
    overflowX: getComputedStyle(el).overflowX,
    overflowY: getComputedStyle(el).overflowY,
  }))
  .filter(
    (x) =>
      x.overflow !== "visible" ||
      x.overflowX !== "visible" ||
      x.overflowY !== "visible"
  );
```

重点看：

```txt
1. 哪个元素 overflow 是 auto/scroll
2. 哪个元素宽度超过 960
3. 哪个元素高度超过 540
4. 哪个元素有 transform/scale
5. 哪个元素实际出滚动条
```

---

# 18. 验收标准

## 18.1 基础验收

```txt
1. 标准 16:9 PPTX 能完整显示
2. 页面首次打开不出现内部滚动条
3. 左右切换正常
4. zoom in/out 正常
5. reset zoom 正常
6. 全屏后重新适配
7. 退出全屏后重新适配
8. 浏览器窗口缩放后重新适配
```

## 18.2 异常文件验收

```txt
1. 损坏 PPTX 显示错误状态
2. pptx-preview 渲染失败后进入 summary fallback
3. .ppt 显示旧格式不支持提示
4. 含 EMF/WMF 图片的 PPTX 不显示大量 broken image icon
5. 日文 PPT 不应因为字体 fallback 过度撑破页面
```

## 18.3 布局验收

```txt
1. 外层容器 640px 高度可正常显示
2. 外层容器 400px 高度可正常显示
3. 左侧文件列表存在时可正常显示
4. 移动端窄屏不撑破页面
5. slide 模式内部无横向滚动条
6. slide 模式内部无纵向滚动条
7. content 外层允许整体滚动，但单页 stage 内不滚
```

---

# 19. 实施步骤

## Step 1：移除 CSS zoom

删除：

```tsx
style={{
  zoom: zoom / 100,
}}
```

替换为：

```tsx
transform: scale(...)
```

## Step 2：新增 usePptxFitScale

新增：

```txt
packages/file-preview/src/pptx/usePptxFitScale.ts
```

## Step 3：改造 PptxRenderContainer

加入：

```txt
stage
scale-layer
render-container
```

## Step 4：改造 CSS

加入：

```txt
.fv-pptx__stage
.fv-pptx__scale-layer
.fv-pptx__render-container--slide
```

## Step 5：全屏和 ResizeObserver 联动

确保全屏前后重新计算 fitScale。

## Step 6：增加 summary fallback

新增：

```txt
read-pptx-insight.ts
PptxSummaryFallback.tsx
```

## Step 7：补测试样例

准备：

```txt
sample-16x9.pptx
sample-4x3.pptx
sample-japanese-table.pptx
sample-large-table.pptx
sample-with-emf.pptx
broken.pptx
legacy.ppt
```

---

# 20. 推荐版本规划

## 0.4.1：PPTX 适配稳定版

范围：

```txt
1. 去掉 CSS zoom
2. fitScale
3. transform scale stage
4. overflow 修复
5. CJK font fallback
6. 全屏重新适配
```

## 0.4.2：PPTX fallback 版

范围：

```txt
1. PPTX summary fallback
2. slide 文本提取
3. 图片数量统计
4. 高保真失败后自动降级
```

## 0.4.3：PPTX 多引擎准备版

范围：

```txt
1. 抽象 PptxRenderer interface
2. pptx-preview renderer
3. summary renderer
4. 预留 serverConvert renderer
```

---

# 21. 最终建议

当前 PPTX 预览的问题，优先不要换渲染库，也不要重写 PPTX 解析。

第一优先级是补齐：

```txt
viewer-level fit-to-container
```

也就是：

```txt
真实容器尺寸
  ↓
fitScale
  ↓
displayScale
  ↓
stage 占位
  ↓
transform scale
```

完成这一步后，你的 PPTX 预览会从“不稳定的局部裁切”变成“稳定完整显示”。

之后再补：

```txt
summary fallback
旧版 .ppt 明确不支持
未来多渲染引擎
```

这样整体会比单纯包装 `pptx-preview` 更稳定，也更接近一个真实生产可用的文件预览 SDK。

