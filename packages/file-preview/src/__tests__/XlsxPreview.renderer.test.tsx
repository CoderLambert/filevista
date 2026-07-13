// @vitest-environment jsdom

import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
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

vi.mock("../XlsxTablePreview", () => ({
  XlsxTablePreview: () => <div data-testid="table-renderer" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("XlsxPreview renderer selection", () => {
  it("uses the table renderer without exposing an enhanced renderer switch", async () => {
    const { XlsxPreview } = await import("../XlsxPreview");
    const view = render(
      <XlsxPreview content="ignored" fileName="test.xlsx" fileSize={1024} />,
    );

    await waitFor(() => {
      expect(view.getByTestId("table-renderer")).toBeTruthy();
    });
    expect(view.queryByRole("button", { name: "增强" })).toBeNull();
  });
});
