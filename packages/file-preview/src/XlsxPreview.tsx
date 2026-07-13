"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangleIcon,
  Table2Icon,
} from "./icons";
import "./styles/XlsxPreview.css";
import { XLSX_PREVIEW_LIMITS } from "./limits";
import type { PreviewSource } from "./core/types";
import { formatFileSize } from "./utils";
import { useLocale } from "./core/i18n";
import type { SheetData, XlsxPreviewMode, SpreadsheetWorkbookData } from "./excel/types";
import { readXlsxWorkbook } from "./excel/read-workbook";
import { transformWorkbookToTableSheets } from "./excel/transform-table";
import { transformWorkbookToSpreadsheetData } from "./excel/transform-spreadsheet";
import { tryLoadXDataSpreadsheet } from "./excel/spreadsheet-loader";
import { XlsxTablePreview } from "./XlsxTablePreview";
import { XlsxSpreadsheetPreview } from "./XlsxSpreadsheetPreview";

type RendererMode = "spreadsheet" | "table";

interface XlsxPreviewProps {
  content?: string | null;
  source?: PreviewSource;
  fileName: string;
  fileSize: number;
}

export function XlsxPreview({ content, source, fileName, fileSize }: XlsxPreviewProps) {
  // ─── State ───
  const [tableSheets, setTableSheets] = useState<SheetData[]>([]);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetWorkbookData | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderer, setRenderer] = useState<RendererMode>("table");
  const [spreadsheetInitFailed, setSpreadsheetInitFailed] = useState(false);
  const [spreadsheetAvailable, setSpreadsheetAvailable] = useState<boolean | null>(null);
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

  // ─── Renderer selection logic ───
  const canUseSpreadsheet =
    mode === "fidelity" &&
    !isLargeFile &&
    spreadsheetAvailable === true &&
    !spreadsheetInitFailed &&
    spreadsheetData !== null;

  const effectiveRenderer: RendererMode = canUseSpreadsheet ? renderer : "table";

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
    setSpreadsheetInitFailed(false);
  }

  // ─── Main parse effect ───
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Read workbook once (includes theme colors from xl/theme/theme1.xml)
        const { workbook, isLegacyXls, themeColors } = await readXlsxWorkbook({ source, content }, fileName);
        if (cancelled) return;

        // 2. Always derive table data (fallback is always available)
        const tableResult = transformWorkbookToTableSheets(workbook, { mode, isLegacyXls, themeColors });
        if (cancelled) return;

        const totalImages = tableResult.reduce((sum, s) => sum + s.imageCount, 0);
        setTableSheets(tableResult);
        setActiveSheet(0);

        // 3. Attempt spreadsheet data if conditions allow
        // But if file has images, force table renderer (spreadsheet doesn't support images)
        const shouldTrySpreadsheet =
          mode === "fidelity" && !isLargeFile && totalImages === 0;

        if (shouldTrySpreadsheet) {
          // Check if x-data-spreadsheet is available (cached after first check)
          const SpreadsheetCtor = await tryLoadXDataSpreadsheet();
          if (cancelled) return;

          if (SpreadsheetCtor) {
            setSpreadsheetAvailable(true);
            const ssData = transformWorkbookToSpreadsheetData(workbook, { mode, themeColors });
            if (cancelled) return;
            setSpreadsheetData(ssData);
            // Keep the stable HTML table as the default. The enhanced canvas
            // renderer remains available through the toolbar for consumers
            // that explicitly want Excel-like selection and interaction.
            setRenderer("table");
          } else {
            setSpreadsheetAvailable(false);
            setSpreadsheetData(null);
            setRenderer("table");
          }
        } else {
          setSpreadsheetData(null);
          setRenderer("table");
        }

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
  }, [content, source, fileName, mode, isLargeFile]);

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

  // ─── Renderer switch ───
  const switchRenderer = useCallback(
    (nextRenderer: RendererMode) => {
      if (nextRenderer === renderer) return;
      if (nextRenderer === "spreadsheet" && !canUseSpreadsheet) return;
      setRenderer(nextRenderer);
    },
    [renderer, canUseSpreadsheet],
  );

  // ─── Spreadsheet init failure handler ───
  const handleSpreadsheetInitFailed = useCallback((err: unknown) => {
    console.warn("Enhanced spreadsheet renderer failed, falling back to table:", err);
    setSpreadsheetInitFailed(true);
    setRenderer("table");
  }, []);

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

  const rendererSwitch = canUseSpreadsheet ? (
    <div className="fv-xlsx__renderer-switch">
      <button
        onClick={() => switchRenderer("spreadsheet")}
        className={`fv-xlsx__renderer-btn ${effectiveRenderer === "spreadsheet" ? "fv-xlsx__renderer-btn--active" : ""}`}
        title={t.enhancedRendererTitle}
      >
        {t.enhancedRenderer}
      </button>
      <button
        onClick={() => switchRenderer("table")}
        className={`fv-xlsx__renderer-btn ${effectiveRenderer === "table" ? "fv-xlsx__renderer-btn--active" : ""}`}
        title={t.tableRendererTitle}
      >
        {t.tableRenderer}
      </button>
    </div>
  ) : null;

  // ─── Main render ───
  return (
    <div className="fv-xlsx">
      {/* Spreadsheet toolbar (table renderer owns its own toolbar) */}
      {effectiveRenderer === "spreadsheet" && (
        <div className="fv-xlsx__toolbar">
          <div className="fv-xlsx__toolbar-left">
            <Table2Icon size={14} />
            {/* Mode switch */}
            <div className="fv-xlsx__mode-switch">
              <button
                onClick={() => switchMode("fast")}
                className={`fv-xlsx__mode-btn ${mode === "fast" ? "fv-xlsx__mode-btn--active" : ""}`}
                title={t.fastModeTitle}
              >
                {t.fastMode}
              </button>
              <button
                onClick={() => switchMode("fidelity")}
                className={`fv-xlsx__mode-btn ${mode === "fidelity" ? "fv-xlsx__mode-btn--active" : ""}`}
                title={t.fidelityModeTitle}
              >
                {t.fidelityMode}
              </button>
            </div>
            {rendererSwitch}
          </div>
          <div className="fv-xlsx__toolbar-right">
            <span className="fv-xlsx__info">{t.enhancedRenderer}</span>
          </div>
        </div>
      )}

      {/* Spreadsheet init failed banner */}
      {spreadsheetInitFailed && (
        <div className="fv-xlsx__legacy-banner">
          <AlertTriangleIcon size={14} />
          <span>{t.enhancedRendererUnavailable}</span>
        </div>
      )}

      {/* Renderer content */}
      {effectiveRenderer === "spreadsheet" && spreadsheetData ? (
        <XlsxSpreadsheetPreview
          data={spreadsheetData}
          activeSheet={activeSheet}
          onActiveSheetChange={setActiveSheet}
          onInitFailed={handleSpreadsheetInitFailed}
        />
      ) : (
        <XlsxTablePreview
          sheets={tableSheets}
          activeSheet={activeSheet}
          onActiveSheetChange={setActiveSheet}
          mode={mode}
          onModeChange={switchMode}
          fileSize={fileSize}
          isLargeFile={isLargeFile}
          isTooLargeForFidelity={isTooLargeForFidelity}
          toolbarExtra={rendererSwitch}
        />
      )}
    </div>
  );
}
