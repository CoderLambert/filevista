// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FileInfo, FileType } from "../utils";
import { LargeFileHint } from "../LargeFileHint";

function createFile(fileType: FileType, size: number): FileInfo {
  return {
    id: `mock-${fileType}`,
    name: `mock.${fileType}`,
    size,
    type: "",
    fileType,
    content: null,
    url: null,
    source: undefined,
  };
}

afterEach(() => {
  cleanup();
});

describe("LargeFileHint", () => {
  it.each(["pdf", "docx", "pptx", "xlsx", "zip", "epub"] as const)(
    "shows hint for large %s files",
    (fileType) => {
      render(<LargeFileHint file={createFile(fileType, 20 * 1024 * 1024)} />);

      expect(
        screen.getByText(/当前文件较大，浏览器端解析可能需要更长时间/)
      ).toBeInTheDocument();
    }
  );

  it("does not show hint for heavy file types below threshold", () => {
    render(<LargeFileHint file={createFile("pdf", 20 * 1024 * 1024 - 1)} />);

    expect(
      screen.queryByText(/当前文件较大，浏览器端解析可能需要更长时间/)
    ).not.toBeInTheDocument();
  });

  it.each(["text", "markdown", "json", "code", "image", "audio", "video"] as const)(
    "does not show hint for non-heavy %s files even when large",
    (fileType) => {
      render(<LargeFileHint file={createFile(fileType, 100 * 1024 * 1024)} />);

      expect(
        screen.queryByText(/当前文件较大，浏览器端解析可能需要更长时间/)
      ).not.toBeInTheDocument();
    }
  );
});
