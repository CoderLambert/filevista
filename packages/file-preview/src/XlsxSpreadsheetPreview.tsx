"use client";

/**
 * XlsxSpreadsheetPreview — enhanced Excel renderer using x-data-spreadsheet.
 *
 * This renderer is optional. If x-data-spreadsheet is unavailable or fails
 * to initialize, the parent component falls back to XlsxTablePreview.
 */

import { useEffect, useRef } from "react";
import { loadXDataSpreadsheet } from "./excel/spreadsheet-loader";
import type { SpreadsheetWorkbookData } from "./excel/types";

type SpreadsheetInstance = {
  bottombar?: {
    swapFunc?: (index: number) => void;
  };
  on?: (event: string, handler: (...args: any[]) => void) => void;
  sheet?: {
    reload?: () => void;
  };
};

export interface XlsxSpreadsheetPreviewProps {
  data: SpreadsheetWorkbookData;
  activeSheet: number;
  onActiveSheetChange?: (index: number) => void;
  onInitFailed?: (error: unknown) => void;
  onCellSelected?: (payload: {
    cell: unknown;
    rowIndex: number;
    columnIndex: number;
  }) => void;
  onCellsSelected?: (payload: {
    cell: unknown;
    startRowIndex: number;
    startColumnIndex: number;
    endRowIndex: number;
    endColumnIndex: number;
  }) => void;
}

export function XlsxSpreadsheetPreview({
  data,
  activeSheet,
  onActiveSheetChange,
  onInitFailed,
  onCellSelected,
  onCellsSelected,
}: XlsxSpreadsheetPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const spreadsheetRef = useRef<SpreadsheetInstance | null>(null);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let previousWidth = 0;
    let previousHeight = 0;

    const stopObserving = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }
    };

    const observeContainer = (xs: SpreadsheetInstance) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || typeof ResizeObserver === "undefined") return;

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        const width = Math.round(entry?.contentRect.width ?? wrapper.clientWidth);
        const height = Math.round(entry?.contentRect.height ?? wrapper.clientHeight);

        // Hidden tabs commonly report 0x0. Wait for the observer notification
        // emitted when the tab/dialog becomes visible instead of laying out the
        // spreadsheet against invalid dimensions.
        if (width <= 0 || height <= 0) return;
        if (width === previousWidth && height === previousHeight) return;
        previousWidth = width;
        previousHeight = height;

        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (!disposed && spreadsheetRef.current === xs) {
            // x-data-spreadsheet exposes reload on its sheet object. It reads
            // the view callbacks again and resizes the canvas and scrollbars.
            xs.sheet?.reload?.();
          }
        });
      });

      resizeObserver.observe(wrapper);
    };

    async function mount() {
      try {
        if (!hostRef.current || !wrapperRef.current) return;

        const Spreadsheet = await loadXDataSpreadsheet();
        if (disposed || !hostRef.current || !wrapperRef.current) return;

        hostRef.current.innerHTML = "";

        const xs = new Spreadsheet(hostRef.current, {
          mode: "read",
          showToolbar: false,
          showContextmenu: false,
          showBottomBar: true,
          view: {
            height: () => wrapperRef.current?.clientHeight || 300,
            width: () => wrapperRef.current?.clientWidth || 1200,
          },
          row: {
            len: 100,
            height: 24,
          },
          col: {
            len: 26,
            width: 80,
            indexWidth: 60,
            minWidth: 50,
          },
        }).loadData(data.sheets as any);

        spreadsheetRef.current = xs as SpreadsheetInstance;
        observeContainer(xs as SpreadsheetInstance);

        // x-data-spreadsheet event hooks
        xs.on?.("cell-selected", (cell: unknown, ri: number, ci: number) => {
          onCellSelected?.({ cell, rowIndex: ri, columnIndex: ci });
        });

        xs.on?.(
          "cells-selected",
          (
            cell: unknown,
            range: { sri: number; sci: number; eri: number; eci: number },
          ) => {
            onCellsSelected?.({
              cell,
              startRowIndex: range.sri,
              startColumnIndex: range.sci,
              endRowIndex: range.eri,
              endColumnIndex: range.eci,
            });
          },
        );

        // Keep parent active sheet in sync when possible.
        const bottomBar = xs.bottombar;
        if (bottomBar?.swapFunc) {
          const originalSwap = bottomBar.swapFunc;
          bottomBar.swapFunc = function (index: number) {
            originalSwap.call(bottomBar, index);
            onActiveSheetChange?.(index);
          };
        }

        // Best-effort initial sheet activation.
        if (activeSheet > 0 && bottomBar?.swapFunc) {
          bottomBar.swapFunc(activeSheet);
        }
      } catch (error) {
        onInitFailed?.(error);
      }
    }

    mount();

    return () => {
      disposed = true;
      stopObserving();
      spreadsheetRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [data, activeSheet, onActiveSheetChange, onInitFailed, onCellSelected, onCellsSelected]);

  return (
    <div ref={wrapperRef} className="fv-xlsx__spreadsheet">
      <div ref={hostRef} className="fv-xlsx__spreadsheet-host" />
    </div>
  );
}
