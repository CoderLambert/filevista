/**
 * XlsxSpreadsheetPreview — enhanced Excel renderer using x-data-spreadsheet.
 *
 * This renderer is optional. If x-data-spreadsheet is unavailable or fails
 * to initialize, the parent component falls back to XlsxTablePreview.
 */

import { useEffect, useRef } from "react";
import { loadXDataSpreadsheet } from "./excel/spreadsheet-loader";
import type { SpreadsheetWorkbookData } from "./excel/types";

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
  const spreadsheetRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;

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

        spreadsheetRef.current = xs;

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
