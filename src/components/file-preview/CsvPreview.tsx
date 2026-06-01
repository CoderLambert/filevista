"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, Search } from "lucide-react";

interface CsvPreviewProps {
  content: string;
  fileName: string;
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function parseCsv(content: string): ParsedCsv {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

export function CsvPreview({ content, fileName }: CsvPreviewProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const { headers, rows } = useMemo(() => parseCsv(content), [content]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    return rows.filter((row) =>
      row.some((cell) =>
        cell.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [rows, searchTerm]);

  const sortedRows = useMemo(() => {
    if (sortColumn === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortColumn] || "";
      const valB = b[sortColumn] || "";
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }, [filteredRows, sortColumn, sortAsc]);

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(colIndex);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search in table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {sortedRows.length} row{sortedRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-medium w-12 text-xs">
                #
              </th>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-xs cursor-pointer hover:bg-muted transition-colors whitespace-nowrap"
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1">
                    <span>{header || `Column ${i + 1}`}</span>
                    <ArrowUpDown
                      size={12}
                      className={
                        sortColumn === i
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      }
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b hover:bg-muted/50 transition-colors"
              >
                <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                  {rowIdx + 1}
                </td>
                {headers.map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-2 whitespace-nowrap">
                    {row[colIdx] || ""}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No matching rows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
