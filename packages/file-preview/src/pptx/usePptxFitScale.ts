import { useLayoutEffect, useMemo, useState } from "react";
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
}): number {
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

/**
 * Read the actual padding of the wrap element (slide-wrap / grid-wrap) that
 * sits inside the viewport container. The stage lives inside this wrap, so
 * the available space for the stage is the viewport rect minus the wrap's
 * padding — not a fixed constant.
 */
function measureWrapPadding(el: HTMLElement): { padH: number; padV: number } {
  const wrapEl = el.firstElementChild as HTMLElement | null;
  if (!wrapEl) return { padH: PPTX_STAGE_PADDING, padV: PPTX_STAGE_PADDING };
  const style = window.getComputedStyle(wrapEl);
  const padH =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0);
  const padV =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0);
  return { padH: padH || PPTX_STAGE_PADDING, padV: padV || PPTX_STAGE_PADDING };
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

  // Use useLayoutEffect so the initial measurement (and any re-measurement
  // triggered by dependency changes) happens synchronously BEFORE the browser
  // paints. With useEffect, the first render uses the default state
  // (viewportWidth = baseWidth = 960), producing a visible flash where the
  // stage is wider than the actual container before the async effect corrects
  // it. useLayoutEffect eliminates that flash entirely.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const { padH, padV } = measureWrapPadding(el);

      // Use the wrap's actual padding to compute available space for the
      // stage. Previously we subtracted a fixed PPTX_STAGE_PADDING (32px),
      // but the slide-wrap's own padding is 64px on desktop (2rem per side),
      // which caused the stage to overflow horizontally when zoomed in.
      const viewportWidth = Math.max(1, rect.width - padH);
      // For height we still use the fixed padding as a safe minimum, because
      // the wrap has `min-height: 100%` and grows with content — using its
      // own padding-based height would over-estimate the visible viewport.
      const viewportHeight = Math.max(1, rect.height - Math.max(padV, padding));

      setSize({ viewportWidth, viewportHeight });
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Also observe the wrap element so we recompute when its padding changes
    // (e.g. the 768px media query switching slide-wrap padding from 1rem to
    // 2rem). Wrap width changes are covered implicitly by observing the
    // viewport container.
    const wrapEl = el.firstElementChild as HTMLElement | null;
    if (wrapEl) observer.observe(wrapEl);

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

    const rawDisplayScale = fitScale * (userZoom / 100);

    // Clamp the display scale so the stage width never exceeds the viewport
    // width. Without this, zooming in makes the slide wider than the
    // container, which produces scrollbars / flex-centering overflow in slide
    // mode. Height still scales proportionally (aspect ratio preserved).
    const maxScaleByWidth = size.viewportWidth / baseWidth;
    const displayScale = normalizeScale(
      Math.min(rawDisplayScale, maxScaleByWidth)
    );

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
