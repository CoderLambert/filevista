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
