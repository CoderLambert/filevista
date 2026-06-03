// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsupportedPluginPreview } from "../UnsupportedPluginPreview";

const DOC_BASE64 = "SGVsbG8="; // "Hello"

let createObjectURLMock: ReturnType<typeof vi.fn>;
let revokeObjectURLMock: ReturnType<typeof vi.fn>;
let anchorClickMock: ReturnType<typeof vi.fn>;
let lastAnchor: HTMLAnchorElement | null;

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  lastAnchor = null;

  createObjectURLMock = vi.fn(() => "blob:mock-download-url");
  revokeObjectURLMock = vi.fn();
  anchorClickMock = vi.fn(() => {});

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURLMock,
  });

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    anchorClickMock as unknown as () => void
  );

  vi.spyOn(document, "createElement").mockImplementation(
    ((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);

      if (tagName.toLowerCase() === "a") {
        lastAnchor = element as HTMLAnchorElement;
      }

      return element;
    }) as typeof document.createElement
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("UnsupportedPluginPreview", () => {
  it("renders default unknown unsupported state without download button", () => {
    render(<UnsupportedPluginPreview fileType="unknown" />);

    expect(screen.getByText("Preview Not Available")).toBeInTheDocument();
    expect(
      screen.getByText("该文件类型 (unknown) 暂不支持浏览器端预览。")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /下载原文件/ })
    ).not.toBeInTheDocument();
  });

  it.each([
    ["doc", "旧版 Word 格式暂不支持", ".docx"],
    ["ppt", "旧版 PowerPoint 格式暂不支持", ".pptx"],
    ["xls", "旧版 Excel 格式暂不支持", ".xlsx"],
  ] as const)(
    "renders Chinese unsupported copy and download button for %s",
    (fileType, expectedTitle, expectedTargetExt) => {
      render(
        <UnsupportedPluginPreview
          fileType={fileType}
          fileName={`legacy.${fileType}`}
          content={DOC_BASE64}
        />
      );

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(expectedTargetExt))).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /下载原文件/ })
      ).toBeInTheDocument();
    }
  );

  it("does not render download button when content or fileName is missing", () => {
    const { rerender } = render(
      <UnsupportedPluginPreview fileType="doc" fileName="legacy.doc" />
    );

    expect(
      screen.queryByRole("button", { name: /下载原文件/ })
    ).not.toBeInTheDocument();

    rerender(<UnsupportedPluginPreview fileType="doc" content={DOC_BASE64} />);

    expect(
      screen.queryByRole("button", { name: /下载原文件/ })
    ).not.toBeInTheDocument();
  });

  it("downloads original base64 file and resets button state", () => {
    vi.useFakeTimers();

    render(
      <UnsupportedPluginPreview
        fileType="doc"
        fileName="legacy.doc"
        content={DOC_BASE64}
      />
    );

    const button = screen.getByRole("button", { name: /下载原文件/ });

    fireEvent.click(button);

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/msword");

    expect(lastAnchor).not.toBeNull();
    expect(lastAnchor?.download).toBe("legacy.doc");
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-download-url");

    expect(
      screen.getByRole("button", { name: /已开始下载/ })
    ).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(
      screen.getByRole("button", { name: /下载原文件/ })
    ).toBeEnabled();
  });

  it("uses custom title and description when provided", () => {
    render(
      <UnsupportedPluginPreview
        fileType="unknown"
        title="自定义标题"
        description="自定义描述"
      />
    );

    expect(screen.getByText("自定义标题")).toBeInTheDocument();
    expect(screen.getByText("自定义描述")).toBeInTheDocument();
  });
});
