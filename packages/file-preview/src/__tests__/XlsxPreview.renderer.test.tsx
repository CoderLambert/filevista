// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../excel/read-workbook", () => ({
  readXlsxWorkbook: vi.fn(async () => ({
    workbook: {},
    isLegacyXls: false,
    themeColors: [],
  })),
}));

vi.mock("../excel/transform-table", () => ({
  transformWorkbookToTableSheets: vi.fn(() => [{
    name: "Sheet1",
    cellGrid: [],
    colWidths: [],
    rowHeights: [],
    totalRows: 0,
    totalCols: 0,
    imageCount: 0,
    accRowHeights: [],
  }]),
}));

vi.mock("../excel/transform-spreadsheet", () => ({
  transformWorkbookToSpreadsheetData: vi.fn(() => ({ sheets: [] })),
}));

vi.mock("../excel/spreadsheet-loader", () => ({
  tryLoadXDataSpreadsheet: vi.fn(async () => function FakeSpreadsheet() {}),
}));

vi.mock("../XlsxTablePreview", () => ({
  XlsxTablePreview: ({ toolbarExtra }: { toolbarExtra?: React.ReactNode }) => (
    <div data-testid="table-renderer">{toolbarExtra}</div>
  ),
}));

vi.mock("../XlsxSpreadsheetPreview", () => ({
  XlsxSpreadsheetPreview: () => <div data-testid="enhanced-renderer" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("XlsxPreview renderer selection", () => {
  it("defaults to the table renderer and keeps enhanced rendering opt-in", async () => {
    const { XlsxPreview } = await import("../XlsxPreview");
    const view = render(
      <XlsxPreview content="ignored" fileName="test.xlsx" fileSize={1024} />,
    );

    await waitFor(() => {
      expect(view.getByTestId("table-renderer")).toBeTruthy();
    });
    expect(view.queryByTestId("enhanced-renderer")).toBeNull();

    fireEvent.click(view.getByRole("button", { name: "增强" }));

    await waitFor(() => {
      expect(view.getByTestId("enhanced-renderer")).toBeTruthy();
    });
  });
});
