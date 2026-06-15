// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsupportedPluginPreview } from "../UnsupportedPluginPreview";
import type { FileInfo } from "../../utils";
import { LocaleProvider, zhCN } from "../../core/i18n";

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

/** Wrap component with LocaleProvider for i18n context. */
function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider value={zhCN}>{ui}</LocaleProvider>);
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

    renderWithLocale(<UnsupportedPluginPreview file={file} />);

    expect(screen.getByText(zhCN.previewNotAvailable)).toBeInTheDocument();
    expect(
      screen.getByText(zhCN.unsupportedFileType.replace("{fileType}", "unknown"))
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /download original|下载原文件/i })
    ).toBeInTheDocument();
  });

  it.each([
    ["doc", "legacy.doc", zhCN.legacyDocTitle, ".docx"],
    ["ppt", "legacy.ppt", zhCN.legacyPptTitle, ".pptx"],
    ["xls", "legacy.xls", zhCN.legacyXlsTitle, ".xlsx"],
  ] as const)(
    "renders unsupported copy and download button for %s",
    (fileType, fileName, expectedTitle, expectedTargetExt) => {
      renderWithLocale(<UnsupportedPluginPreview file={makeLegacyFile(fileType, fileName)} />);

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(expectedTargetExt))).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /download original|下载原文件/i })
      ).toBeInTheDocument();
    }
  );

  it("renders download button when file has source", () => {
    renderWithLocale(<UnsupportedPluginPreview file={makeLegacyFile("doc", "legacy.doc")} />);

    expect(
      screen.getByRole("button", { name: /download original|下载原文件/i })
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

    renderWithLocale(
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
    renderWithLocale(<UnsupportedPluginPreview file={file} />);

    const button = screen.getByRole("button", { name: /download original|下载原文件/i });

    fireEvent.click(button);

    expect(downloadSource).toHaveBeenCalledWith(
      file.source,
      file.name,
      file.type,
    );
  });
});
