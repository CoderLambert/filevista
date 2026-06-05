// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsupportedPluginPreview } from "../UnsupportedPluginPreview";
import type { FileInfo } from "../../utils";

vi.mock("../../core/download", () => ({
  downloadSource: vi.fn(),
}));

const DOC_BASE64 = "SGVsbG8="; // "Hello"

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

import { downloadSource } from "../../core/download";

beforeEach(() => {
  vi.mocked(downloadSource).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeLegacyFile(
  fileType: "doc" | "ppt" | "xls",
  name: string = `legacy.${fileType}`
): FileInfo {
  const bytes = base64ToUint8Array(DOC_BASE64);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  const mimeTypes: Record<string, string> = {
    doc: "application/msword",
    ppt: "application/vnd.ms-powerpoint",
    xls: "application/vnd.ms-excel",
  };

  return {
    id: "test-1",
    name,
    size: bytes.length,
    type: mimeTypes[fileType] || "application/octet-stream",
    fileType,
    source: {
      kind: "arrayBuffer",
      buffer,
      name,
      mimeType: mimeTypes[fileType] || "application/octet-stream",
    },
  };
}

describe("UnsupportedPluginPreview", () => {
  it("renders default unknown unsupported state", () => {
    const file: FileInfo = {
      id: "test-1",
      name: "unknown-file",
      size: 0,
      type: "",
      fileType: "unknown",
      source: { kind: "file", file: new File([], "unknown-file") },
    };

    render(<UnsupportedPluginPreview file={file} />);

    expect(screen.getByText("Preview Not Available")).toBeInTheDocument();
    expect(
      screen.getByText("该文件类型 (unknown) 暂不支持浏览器端预览。")
    ).toBeInTheDocument();

    // With source-first, every FileInfo has a source, so download is always available
    expect(
      screen.getByRole("button", { name: /download original/i })
    ).toBeInTheDocument();
  });

  it.each([
    ["doc", "legacy.doc", "旧版 Word 格式暂不支持", ".docx"],
    ["ppt", "legacy.ppt", "旧版 PowerPoint 格式暂不支持", ".pptx"],
    ["xls", "legacy.xls", "旧版 Excel 格式暂不支持", ".xlsx"],
  ] as const)(
    "renders Chinese unsupported copy and download button for %s",
    (fileType, fileName, expectedTitle, expectedTargetExt) => {
      render(<UnsupportedPluginPreview file={makeLegacyFile(fileType, fileName)} />);

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(expectedTargetExt))).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /download original/i })
      ).toBeInTheDocument();
    }
  );

  it("renders download button when file has source", () => {
    render(<UnsupportedPluginPreview file={makeLegacyFile("doc", "legacy.doc")} />);

    expect(
      screen.getByRole("button", { name: /download original/i })
    ).toBeInTheDocument();
  });

  it("uses custom title and description when provided", () => {
    const file: FileInfo = {
      id: "test-1",
      name: "unknown-file",
      size: 0,
      type: "",
      fileType: "unknown",
      source: { kind: "file", file: new File([], "unknown-file") },
    };

    render(
      <UnsupportedPluginPreview
        file={file}
        title="自定义标题"
        description="自定义描述"
      />
    );

    expect(screen.getByText("自定义标题")).toBeInTheDocument();
    expect(screen.getByText("自定义描述")).toBeInTheDocument();
  });

  it("download triggers source download via PreviewFallback", async () => {
    const file = makeLegacyFile("doc", "legacy.doc");
    render(<UnsupportedPluginPreview file={file} />);

    const button = screen.getByRole("button", { name: /download original/i });

    fireEvent.click(button);

    // The download goes through downloadSource
    expect(downloadSource).toHaveBeenCalledWith(
      file.source,
      file.name,
      file.type,
    );
  });
});
