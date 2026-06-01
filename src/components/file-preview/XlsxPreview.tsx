"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import JSZip from "jszip";
import { ArrowUpDown, Search, Table2 } from "lucide-react";

interface XlsxPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

interface SheetData {
  name: string;
  rows: string[][];
}

function extractCellReferences(rangeRef: string): { minCol: number; minRow: number; maxCol: number; maxRow: number } {
  const match = rangeRef.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (!match) return { minCol: 0, minRow: 0, maxCol: 0, maxRow: 0 };

  const colToNum = (col: string) => {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num - 1;
  };

  return {
    minCol: colToNum(match[1]),
    minRow: parseInt(match[2]) - 1,
    maxCol: colToNum(match[3]),
    maxRow: parseInt(match[4]) - 1,
  };
}

function colNumToLetter(num: number): string {
  let result = "";
  num++;
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    let text = "";
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += tMatch[1];
    }
    strings.push(text);
  }
  return strings;
}

function parseSheetXml(xml: string, sharedStrings: string[]): { name: string; rows: string[][] } {
  const rows: string[][] = [];

  // Get dimension
  const dimMatch = xml.match(/<dimension\s+ref="([^"]+)"/);
  let maxCol = 25; // default A-Z
  let maxRow = 100;
  if (dimMatch) {
    const dims = extractCellReferences(dimMatch[1]);
    maxCol = Math.min(dims.maxCol, 50);
    maxRow = Math.min(dims.maxRow, 500);
  }

  // Initialize empty rows
  for (let r = 0; r <= maxRow; r++) {
    rows.push(new Array(maxCol + 1).fill(""));
  }

  // Parse rows
  const rowRegex = /<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowNum = parseInt(rowMatch[1]) - 1;
    if (rowNum > maxRow) continue;

    const rowContent = rowMatch[2];
    const cellRegex = /<c\s+r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?(?:<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>[\s\S]*?<\/is>)?<\/c>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colStr = cellMatch[1];
      const colNum = colStr.length === 1
        ? colStr.charCodeAt(0) - 65
        : colStr.split("").reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0) - 1;
      const attrs = cellMatch[3];
      const inlineValue = cellMatch[5];
      const cellValue = cellMatch[4];

      if (colNum > maxCol || rowNum > maxRow) continue;

      const isString = attrs.includes('t="s"');
      const isInlineString = attrs.includes('t="inlineStr"');

      if (isString && cellValue !== undefined) {
        const idx = parseInt(cellValue);
        rows[rowNum][colNum] = idx < sharedStrings.length ? sharedStrings[idx] : cellValue;
      } else if (isInlineString && inlineValue !== undefined) {
        rows[rowNum][colNum] = inlineValue;
      } else if (cellValue !== undefined) {
        rows[rowNum][colNum] = cellValue;
      }
    }
  }

  // Trim empty trailing rows and columns
  let lastNonEmptyRow = 0;
  let lastNonEmptyCol = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c]) {
        lastNonEmptyRow = Math.max(lastNonEmptyRow, r);
        lastNonEmptyCol = Math.max(lastNonEmptyCol, c);
      }
    }
  }

  const trimmedRows = rows.slice(0, lastNonEmptyRow + 2).map(row => row.slice(0, lastNonEmptyCol + 2));

  return { name: "", rows: trimmedRows };
}

async function parseXlsx(base64Content: string): Promise<SheetData[]> {
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes.buffer);
  const sheets: SheetData[] = [];

  // Load shared strings
  let sharedStrings: string[] = [];
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (sharedStringsFile) {
    const ssXml = await sharedStringsFile.async("string");
    sharedStrings = parseSharedStrings(ssXml);
  }

  // Load workbook to get sheet names
  const workbookFile = zip.file("xl/workbook.xml");
  let sheetNames: string[] = [];
  if (workbookFile) {
    const wbXml = await workbookFile.async("string");
    const nameRegex = /<sheet\s+name="([^"]+)"/g;
    let nameMatch;
    while ((nameMatch = nameRegex.exec(wbXml)) !== null) {
      sheetNames.push(nameMatch[1]);
    }
  }

  // Find and parse all sheet files
  const sheetFiles: { index: number; path: string }[] = [];
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if (match) {
      sheetFiles.push({ index: parseInt(match[1]), path: relativePath });
    }
  });
  sheetFiles.sort((a, b) => a.index - b.index);

  for (let i = 0; i < sheetFiles.length; i++) {
    const sheetFile = zip.file(sheetFiles[i].path);
    if (!sheetFile) continue;

    const sheetXml = await sheetFile.async("string");
    const sheetData = parseSheetXml(sheetXml, sharedStrings);
    sheetData.name = sheetNames[i] || `Sheet ${i + 1}`;
    sheets.push(sheetData);
  }

  return sheets;
}

export function XlsxPreview({ content, fileName }: XlsxPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parseXlsx(content);
      setSheets(result);
    } catch (err) {
      console.error("Error parsing XLSX:", err);
      setError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => { parseFile(); }, [parseFile]);

  const currentSheet = sheets[activeSheet];

  const filteredAndSortedRows = useMemo(() => {
    if (!currentSheet) return [];
    let rows = currentSheet.rows;

    // Skip first row for filtering, keep as header
    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    const filtered = searchTerm
      ? dataRows.filter(row => row.some(cell => cell.toLowerCase().includes(searchTerm.toLowerCase())))
      : dataRows;

    if (sortColumn !== null) {
      const sorted = [...filtered].sort((a, b) => {
        const valA = a[sortColumn] || "";
        const valB = b[sortColumn] || "";
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) return sortAsc ? numA - numB : numB - numA;
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
      return [header, ...sorted];
    }

    return [header, ...filtered];
  }, [currentSheet, searchTerm, sortColumn, sortAsc]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Parsing spreadsheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <p className="text-lg font-medium">Parsing Failed</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
        <p className="text-lg font-medium">No Sheets Found</p>
      </div>
    );
  }

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) setSortAsc(!sortAsc);
    else { setSortColumn(colIndex); setSortAsc(true); }
  };

  const displayRows = filteredAndSortedRows;
  const header = displayRows[0] || [];
  const dataRows = displayRows.slice(1);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Table2 size={14} className="text-muted-foreground" />
          {sheets.length > 1 && (
            <div className="flex gap-1">
              {sheets.map((sheet, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveSheet(i); setSortColumn(null); setSearchTerm(""); }}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    i === activeSheet
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-36 pl-8 pr-3 py-1 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {dataRows.length} row{dataRows.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-medium w-12 text-xs">#</th>
              {header.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-xs cursor-pointer hover:bg-muted transition-colors whitespace-nowrap"
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1">
                    <span>{h || `${colNumToLetter(i)}`}</span>
                    <ArrowUpDown size={10} className={sortColumn === i ? "text-foreground" : "text-muted-foreground/30"} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-3 py-1.5 text-muted-foreground text-xs font-mono">{rowIdx + 1}</td>
                {header.map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                    {row[colIdx] || ""}
                  </td>
                ))}
              </tr>
            ))}
            {dataRows.length === 0 && (
              <tr>
                <td colSpan={header.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
