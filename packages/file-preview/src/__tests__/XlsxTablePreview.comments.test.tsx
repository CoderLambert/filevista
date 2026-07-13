// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { XlsxTablePreview } from "../XlsxTablePreview";
import type { SheetData } from "../excel/types";

const sheets: SheetData[] = [{
  name: "Sheet1",
  cellGrid: [[{
    value: "Commented cell",
    style: { comment: "A test comment" },
  }]],
  colWidths: [120],
  rowHeights: [24],
  totalRows: 1,
  totalCols: 1,
  imageCount: 0,
  accRowHeights: [0, 24],
}];

afterEach(cleanup);

describe("XlsxTablePreview comment tooltip", () => {
  it("uses viewport coordinates and closes when the table scrolls", () => {
    const view = render(
      <XlsxTablePreview
        sheets={sheets}
        activeSheet={0}
        onActiveSheetChange={() => {}}
        mode="fast"
        onModeChange={() => {}}
        fileSize={1024}
        isLargeFile={false}
        isTooLargeForFidelity={false}
      />,
    );
    const commentDot = view.container.querySelector<HTMLElement>(".fv-xlsx__comment-dot");
    expect(commentDot).not.toBeNull();

    commentDot!.getBoundingClientRect = () => ({
      left: 230,
      top: 180,
      width: 10,
      height: 10,
      right: 240,
      bottom: 190,
      x: 230,
      y: 180,
      toJSON: () => ({}),
    });

    fireEvent.mouseEnter(commentDot!);

    const tooltip = view.container.querySelector<HTMLElement>(".fv-xlsx__comment-tooltip");
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveStyle({ left: "235px", top: "172px" });

    fireEvent.scroll(view.container.querySelector(".fv-xlsx__content")!);
    expect(view.container.querySelector(".fv-xlsx__comment-tooltip")).toBeNull();

    fireEvent.mouseEnter(commentDot!);
    expect(view.container.querySelector(".fv-xlsx__comment-tooltip")).not.toBeNull();

    fireEvent(window, new Event("resize"));
    expect(view.container.querySelector(".fv-xlsx__comment-tooltip")).toBeNull();
  });
});
