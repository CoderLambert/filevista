"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangleIcon } from "./icons";
import "./styles/XlsxPreview.css";
import { XLSX_PREVIEW_LIMITS } from "./limits";
import type { PreviewSource } from "./core/types";
import { formatFileSize } from "./utils";
import { useLocale } from "./core/i18n";
import type { SheetData, XlsxPreviewMode } from "./excel/types";
import { readXlsxWorkbook } from "./excel/read-workbook";
import { transformWorkbookToTableSheets } from "./excel/transform-table";
import { XlsxTablePreview } from "./XlsxTablePreview";

interface XlsxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
  fileSize: number;
}

export function XlsxPreview({ content, source, fileName, fileSize }: XlsxPreviewProps) {
  // ─── State ───
  const [tableSheets, setTableSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const t = useLocale();

  const [mode, setMode] = useState<XlsxPreviewMode>(() => {
    return fileSize > XLSX_PREVIEW_LIMITS.LARGE_FILE_SIZE ? "fast" : "fidelity";
  });

  const isLargeFile = fileSize > XLSX_PREVIEW_LIMITS.LARGE_FILE_SIZE;
  const isTooLargeForFidelity = fileSize > XLSX_PREVIEW_LIMITS.MAX_FIDELITY_FILE_SIZE;

  // Show mode selection dialog for large files on first load
  useEffect(() => {
    if (isLargeFile && loading && !showModeDialog) {
      setShowModeDialog(true);
      setLoading(false); // Pause loading until user selects mode
    }
  }, [isLargeFile, loading, showModeDialog]);

  // ─── Reset on input change ───
  const [prevDeps, setPrevDeps] = useState({ content, source, fileName, mode });
  if (
    prevDeps.content !== content ||
    prevDeps.source !== source ||
    prevDeps.fileName !== fileName ||
    prevDeps.mode !== mode
  ) {
    setPrevDeps({ content, source, fileName, mode });
    setLoading(true);
    setError(null);
  }

  // ─── Main parse effect ───
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Read workbook once (includes theme colors from xl/theme/theme1.xml)
        const { workbook, isLegacyXls, themeColors } = await readXlsxWorkbook({ source, content }, fileName);
        if (cancelled) return;

        // 2. Derive the stable HTML table representation.
        const tableResult = transformWorkbookToTableSheets(workbook, { mode, isLegacyXls, themeColors });
        if (cancelled) return;

        setTableSheets(tableResult);
        setActiveSheet(0);

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("XLSX parse error:", err);
        const ext = fileName.toLowerCase().split(".").pop() || "";
        if (ext === "xls") {
          setError(t.legacyXlsError);
        } else {
          setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content, source, fileName, mode]);

  // ─── Mode switch ───
  const switchMode = useCallback(
    (nextMode: XlsxPreviewMode) => {
      if (nextMode === mode) return;
      if (nextMode === "fidelity" && isTooLargeForFidelity) {
        const confirmed = window.confirm(
          t.largeFileFidelityConfirm.replace("{fileSize}", formatFileSize(fileSize))
        );
        if (!confirmed) return;
      }
      setMode(nextMode);
    },
    [mode, isTooLargeForFidelity, fileSize, t],
  );

  // ─── Mode selection handlers ───
  const handleSelectFastMode = useCallback(() => {
    setMode("fast");
    setShowModeDialog(false);
    setLoading(true);
  }, []);

  const handleSelectFidelityMode = useCallback(() => {
    if (isTooLargeForFidelity) {
      const confirmed = window.confirm(
        t.largeFileFidelityConfirm.replace("{fileSize}", formatFileSize(fileSize))
      );
      if (!confirmed) return;
    }
    setMode("fidelity");
    setShowModeDialog(false);
    setLoading(true);
  }, [isTooLargeForFidelity, fileSize, t]);

  // ─── Mode selection dialog ───
  if (showModeDialog) {
    return (
      <div className="fv-xlsx__state">
        <div className="fv-xlsx__mode-dialog">
          <AlertTriangleIcon size={36} className="fv-xlsx__mode-dialog-icon" />
          <h3 className="fv-xlsx__mode-dialog-title">{t.modeSelectionTitle}</h3>
          <p className="fv-xlsx__mode-dialog-desc">
            {t.modeSelectionDesc.replace("{fileSize}", formatFileSize(fileSize))}
          </p>
          <div className="fv-xlsx__mode-dialog-options">
            <button
              onClick={handleSelectFastMode}
              className="fv-xlsx__mode-dialog-option fv-xlsx__mode-dialog-option--fast"
            >
              <div className="fv-xlsx__mode-dialog-option-title">{t.modeSelectionFastMode}</div>
              <div className="fv-xlsx__mode-dialog-option-desc">{t.modeSelectionFastModeDesc}</div>
            </button>
            <button
              onClick={handleSelectFidelityMode}
              className="fv-xlsx__mode-dialog-option fv-xlsx__mode-dialog-option--fidelity"
            >
              <div className="fv-xlsx__mode-dialog-option-title">{t.modeSelectionFidelityMode}</div>
              <div className="fv-xlsx__mode-dialog-option-desc">{t.modeSelectionFidelityModeDesc}</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="fv-xlsx__state">
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-xlsx__state-msg">{t.loadingSpreadsheet}</p>
      </div>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="fv-xlsx__state fv-xlsx__state--error">
        <AlertTriangleIcon size={36} />
        <p className="fv-xlsx__state-title">{t.parseFailed}</p>
        <p className="fv-xlsx__state-msg">{error}</p>
      </div>
    );
  }

  // ─── Main render ───
  return (
    <div className="fv-xlsx">
      <XlsxTablePreview
        sheets={tableSheets}
        activeSheet={activeSheet}
        onActiveSheetChange={setActiveSheet}
        mode={mode}
        onModeChange={switchMode}
        fileSize={fileSize}
        isLargeFile={isLargeFile}
        isTooLargeForFidelity={isTooLargeForFidelity}
      />
    </div>
  );
}
