/**
 * XlsxTablePreview — HTML table renderer for Excel preview.
 *
 * Extracted from XlsxPreview.tsx to separate rendering concerns.
 * This component handles all table-specific UI state and rendering:
 * search, zoom, scroll, comment tooltips, image display, etc.
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  SearchIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ImageOffIcon,
  MessageSquareIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
} from "./icons";
import type { CellStyle, SheetData, XlsxPreviewMode } from "./excel/types";
import { styleToCss } from "./excel/convert-style";
import { colNumToLetter, MAX_RENDER_ROWS, ROW_NUM_COL_WIDTH } from "./excel/transform-table";
import { XLSX_PREVIEW_LIMITS } from "./limits";
import { formatFileSize } from "./utils";
import { useLocale } from "./core/i18n";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface XlsxTablePreviewProps {
  sheets: SheetData[];
  activeSheet: number;
  onActiveSheetChange: (index: number) => void;
  mode: XlsxPreviewMode;
  onModeChange: (mode: XlsxPreviewMode) => void;
  fileSize: number;
  isLargeFile: boolean;
  isTooLargeForFidelity: boolean;
  toolbarExtra?: React.ReactNode;
}

export function XlsxTablePreview({
  sheets,
  activeSheet,
  onActiveSheetChange,
  mode,
  onModeChange,
  fileSize,
  isLargeFile,
  isTooLargeForFidelity,
  toolbarExtra,
}: XlsxTablePreviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredComment, setHoveredComment] = useState<{ row: number; col: number; text: string; x: number; y: number } | null>(null);
  const t = useLocale();

  const switchMode = useCallback(
    (nextMode: XlsxPreviewMode) => {
      if (nextMode === mode) return;
      if (nextMode === "fidelity" && isTooLargeForFidelity) {
        const confirmed = window.confirm(
          t.largeFileFidelityConfirm.replace("{fileSize}", formatFileSize(fileSize))
        );
        if (!confirmed) return;
      }
      onModeChange(nextMode);
    },
    [mode, isTooLargeForFidelity, fileSize, onModeChange, t],
  );

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeSheet]);

  const currentSheet = sheets[activeSheet];

  const filteredRowIndices = useMemo(() => {
    if (!currentSheet || !debouncedSearch) return null;
    const indices: number[] = [];
    const term = debouncedSearch.toLowerCase();
    currentSheet.cellGrid.forEach((row, idx) => {
      const match = row.some((cell) => cell && (cell.value.toLowerCase().includes(term) || (cell.images && cell.images.length > 0)));
      if (match) indices.push(idx);
    });
    return indices;
  }, [currentSheet, debouncedSearch]);

  const showLegacyWarning = currentSheet?.isLegacyXls;

  if (sheets.length === 0) {
    return (
      <div className="fv-xlsx__state fv-xlsx__state--empty">
        <p className="fv-xlsx__state-title">{t.sheetNotFound}</p>
      </div>
    );
  }

  const rows = currentSheet?.cellGrid || [];
  const isSearch = !!filteredRowIndices;
  const allDisplayRows = isSearch
    ? filteredRowIndices!.map((idx) => ({ row: rows[idx], originalIdx: idx }))
    : rows.map((row, idx) => ({ row, originalIdx: idx }));

  const isTruncated = !isSearch && allDisplayRows.length > MAX_RENDER_ROWS;
  const displayRows = isTruncated ? allDisplayRows.slice(0, MAX_RENDER_ROWS) : allDisplayRows;

  const totalCols = currentSheet?.totalCols || 0;
  const allColWidths = currentSheet?.colWidths || [];

  return (
    <>
      {showLegacyWarning && (
        <div className="fv-xlsx__legacy-banner">
          <AlertTriangleIcon size={14} />
          <span>{t.legacyXlsFallbackDesc}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="fv-xlsx__toolbar">
        <div className="fv-xlsx__toolbar-left">
          {sheets.length > 1 && (
            <div className="fv-xlsx__sheet-tabs">
              {sheets.map((sheet, i) => (
                <button key={i} onClick={() => { onActiveSheetChange(i); setSearchTerm(""); }}
                  className={`fv-xlsx__sheet-tab ${i === activeSheet ? "fv-xlsx__sheet-tab--active" : ""}`}>
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
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
          {toolbarExtra}
        </div>
        <div className="fv-xlsx__toolbar-right">
          <div className="fv-xlsx__search-wrap">
            <SearchIcon size={14} className="fv-xlsx__search-icon" />
            <input type="text" placeholder={t.search} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="fv-xlsx__search-input" />
          </div>
          <div className="fv-xlsx__zoom-group">
            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="fv-xlsx__zoom-btn" title={t.zoomOut}><ZoomOutIcon size={14} /></button>
            <span className="fv-xlsx__zoom-label">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="fv-xlsx__zoom-btn" title={t.zoomIn}><ZoomInIcon size={14} /></button>
          </div>
          <span className="fv-xlsx__info">
            {mode === "fast" && currentSheet?.totalRows > XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT ? (
              <>
                {XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT.toLocaleString()} / {currentSheet.totalRows.toLocaleString()} {t.largeFileRows} × {currentSheet.totalCols} {t.largeFileCols}
              </>
            ) : (
              <>
                {currentSheet?.totalRows?.toLocaleString() || 0} {t.largeFileRows} × {currentSheet?.totalCols || 0} {t.largeFileCols}
                {currentSheet?.imageCount ? ` · ${currentSheet.imageCount} ${t.largeFileImages}` : ""}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Large file banners */}
      {isLargeFile && mode === "fast" && (
        <div className="fv-xlsx__large-banner fv-xlsx__large-banner--warning">
          {t.largeFileFastModeBanner.replace("{fileSize}", formatFileSize(fileSize)).replace("{rowLimit}", XLSX_PREVIEW_LIMITS.FAST_MODE_ROW_LIMIT.toLocaleString())}
        </div>
      )}
      {isLargeFile && mode === "fidelity" && (
        <div className="fv-xlsx__large-banner fv-xlsx__large-banner--danger">
          {t.largeFileFidelityBanner}
        </div>
      )}

      {/* Table */}
      <div ref={scrollRef} className="fv-xlsx__content">
        <div style={{ zoom: zoom / 100 }}>
          <table className="fv-xlsx__table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: ROW_NUM_COL_WIDTH }} />
              {allColWidths.map((w, i) => (<col key={i} style={{ width: w }} />))}
            </colgroup>
            <thead>
              <tr>
                <th className="fv-xlsx__col-header" />
                {allColWidths.map((w, i) => (
                  <th key={i} className="fv-xlsx__col-header">
                    {colNumToLetter(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ row, originalIdx }) => {
                if (!row) return null;
                const rh = currentSheet?.rowHeights[originalIdx] || 0;

                // Calculate min height for images in this row
                let imgMinHeight = 0;
                for (const cell of row) {
                  if (cell?.images) {
                    for (const img of cell.images) {
                      const h = img.unsupported ? 40 : (img.naturalHeight || 60);
                      imgMinHeight = Math.max(imgMinHeight, h + 8);
                    }
                  }
                }
                const effectiveHeight = Math.max(rh, imgMinHeight) || undefined;

                return (
                  <tr key={originalIdx} style={effectiveHeight ? { height: effectiveHeight } : undefined}>
                    <td className="fv-xlsx__row-num">
                      {originalIdx + 1}
                    </td>
                    {row.map((cell, colIdx) => {
                      if (!cell) return null;
                      const cs = styleToCss(cell.style);
                      const db = "1px solid #d1d5db";
                      const fs: React.CSSProperties = {
                        ...cs, padding: "1px 4px", overflow: "visible",
                        whiteSpace: cs.whiteSpace || "nowrap", position: "relative",
                        borderTop: cell.style.borderTop || db, borderRight: cell.style.borderRight || db,
                        borderBottom: cell.style.borderBottom || db, borderLeft: cell.style.borderLeft || db,
                      };

                      const hasImages = cell.images && cell.images.length > 0;
                      const hasHyperlink = !!cell.style.hyperlink;
                      const hasComment = !!cell.style.comment;

                      return (
                        <td key={colIdx} style={fs} rowSpan={cell.rowspan || undefined} colSpan={cell.colspan || undefined}>
                          {hasImages ? (
                            <div className="fv-xlsx__cell-images" style={{ minHeight: 30 }}>
                              {cell.images!.map((img, imgIdx) => (
                                img.unsupported ? (
                                  <div key={imgIdx}
                                    className="fv-xlsx__cell-image-placeholder"
                                    style={{ width: 60, height: 40 }}
                                    title={`${t.unsupportedImageFormat}: ${img.formatName || t.unknown}`}
                                  >
                                    <ImageOffIcon size={14} />
                                    <span style={{ fontSize: 8, color: "#9ca3af" }}>{img.formatName}</span>
                                  </div>
                                ) : (
                                  <img key={imgIdx} src={img.dataUrl!} alt=""
                                    style={{
                                      width: img.naturalWidth || "auto",
                                      height: img.naturalHeight || "auto",
                                      maxWidth: "100%",
                                      objectFit: "contain",
                                      display: "block",
                                    }}
                                    loading="lazy"
                                  />
                                )
                              ))}
                              {cell.value?.trim() && (
                                <span className="fv-xlsx__cell-image-label">{cell.value}</span>
                              )}
                            </div>
                          ) : hasHyperlink ? (
                            <a href={cell.style.hyperlink} target="_blank" rel="noopener noreferrer"
                              className="fv-xlsx__cell-link"
                              style={{ fontSize: "inherit", fontFamily: "inherit" }}>
                              {cell.value}
                              <ExternalLinkIcon size={10} />
                            </a>
                          ) : (
                            cell.value
                          )}
                          {hasComment && (
                            <span className="fv-xlsx__comment-dot"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const container = scrollRef.current?.getBoundingClientRect();
                                setHoveredComment({
                                  row: originalIdx, col: colIdx, text: cell.style.comment!,
                                  x: rect.left - (container?.left ?? 0) + rect.width / 2,
                                  y: rect.top - (container?.top ?? 0),
                                });
                              }}
                              onMouseLeave={() => setHoveredComment(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {isTruncated && (
                <tr>
                  <td colSpan={totalCols + 1} className="fv-xlsx__truncation-row fv-xlsx__truncation-row--warning">
                    {t.truncatedRows.replace("{shown}", MAX_RENDER_ROWS.toLocaleString()).replace("{total}", allDisplayRows.length.toLocaleString())}
                  </td>
                </tr>
              )}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={totalCols + 1} className="fv-xlsx__truncation-row fv-xlsx__truncation-row--empty">
                    {searchTerm ? t.noSearchResults : t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comment tooltip */}
      {hoveredComment && (
        <div className="fv-xlsx__comment-tooltip"
          style={{ left: hoveredComment.x, top: hoveredComment.y - 8, transform: "translate(-50%, -100%)" }}>
          <div className="fv-xlsx__comment-tooltip-header">
            <MessageSquareIcon size={10} /> {t.comment}
          </div>
          <p className="fv-xlsx__comment-tooltip-text">{hoveredComment.text}</p>
        </div>
      )}
    </>
  );
}
