"use client";

import { useState, useMemo } from "react";
import { ArrowUpDownIcon, SearchIcon } from "./icons";
import "./styles/CsvPreview.css";

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
    <div className="fv-csv">
      <div className="fv-csv__toolbar">
        <div className="fv-csv__search-wrap">
          <span className="fv-csv__search-icon"><SearchIcon size={14} /></span>
          <input
            type="text"
            placeholder="Search in table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="fv-csv__search-input"
          />
        </div>
        <span className="fv-csv__row-count">
          {sortedRows.length} row{sortedRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="fv-csv__table-wrap">
        <table className="fv-csv__table">
          <thead className="fv-csv__thead">
            <tr>
              <th className="fv-csv__th fv-csv__th-num">#</th>
              {headers.map((header, i) => (
                <th key={i} className="fv-csv__th" onClick={() => handleSort(i)}>
                  <div className="fv-csv__th-inner">
                    <span>{header || `Column ${i + 1}`}</span>
                    <ArrowUpDownIcon
                      size={12}
                      className={`fv-csv__sort-icon ${sortColumn === i ? "fv-csv__sort-icon--active" : ""}`}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="fv-csv__td fv-csv__td-num">{rowIdx + 1}</td>
                {headers.map((_, colIdx) => (
                  <td key={colIdx} className="fv-csv__td">
                    {row[colIdx] || ""}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={headers.length + 1} className="fv-csv__empty">
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
