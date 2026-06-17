// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type { ComponentType } from "react";
import { PluginPreviewRenderer } from "../PluginPreviewRenderer";
import { createPreviewPluginRegistry } from "../core/registry";
import type { PreviewPlugin } from "../core/plugin";
import type { FileInfo, FileType } from "../core/types";

// ─── helpers ──────────────────────────────────────────────────────────────

function mockFile(fileType: FileType = "pdf"): FileInfo {
  return {
    id: `mock-${fileType}-${Math.random().toString(36).slice(2)}`,
    name: `mock.${fileType}`,
    size: 1,
    type: "",
    fileType,
    source: { kind: "blob", blob: new Blob(["mock"]) },
  };
}

interface StubPlugin {
  plugin: PreviewPlugin;
  load: Mock;
  Component: ComponentType<{ file: FileInfo }>;
}

function stubPlugin(
  fileType: FileType,
  opts: {
    id?: string;
    name?: string;
    component?: ComponentType<{ file: FileInfo }>;
    loadError?: Error;
  } = {},
): StubPlugin {
  const Component =
    opts.component ??
    (({ file }: { file: FileInfo }) => <div data-testid="content">{file.name}</div>);

  const load = vi.fn(async () => {
    if (opts.loadError) throw opts.loadError;
    return { default: Component };
  });

  return {
    Component,
    load,
    plugin: {
      id: opts.id ?? `stub.${fileType}`,
      name: opts.name ?? `Stub ${fileType}`,
      priority: 100,
      match: (file) => file.fileType === fileType,
      load,
    },
  };
}

afterEach(() => {
  cleanup();
});

// ─── routing ──────────────────────────────────────────────────────────────

describe("PluginPreviewRenderer routing", () => {
  it("renders the matched plugin's component with the given file", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);
    const file = mockFile("pdf");

    await act(async () => {
      render(<PluginPreviewRenderer file={file} registry={registry} />);
    });

    expect(await screen.findByTestId("content")).toHaveTextContent(file.name);
    expect(stub.load).toHaveBeenCalledOnce();
  });

  it("falls back to UnsupportedPluginPreview when no plugin matches", async () => {
    const registry = createPreviewPluginRegistry([stubPlugin("pdf").plugin]);
    const file = mockFile("docx"); // not registered
    const onError = vi.fn();

    render(<PluginPreviewRenderer file={file} registry={registry} onError={onError} />);

    // UnsupportedPluginPreview shows the file name in its meta line
    expect(screen.getByText(/mock\.docx/)).toBeInTheDocument();
    // and offers a download button — by label text from the default zhCN locale
    expect(screen.getByRole("button", { name: /下载/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "UNSUPPORTED_FILE_TYPE" }),
      );
    });
  });

  it("shows the plugin debug bar only when showPluginDebug=true", async () => {
    const stub = stubPlugin("pdf", { id: "stub.x", name: "Debug Stub" });
    const registry = createPreviewPluginRegistry([stub.plugin]);
    const fileA = mockFile("pdf");
    const fileB = mockFile("pdf");

    let utils: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <PluginPreviewRenderer file={fileA} registry={registry} />,
      );
    });
    await screen.findByTestId("content");
    expect(screen.queryByText("Plugin Renderer")).not.toBeInTheDocument();

    await act(async () => {
      utils!.rerender(
        <PluginPreviewRenderer
          file={fileB}
          registry={registry}
          showPluginDebug
        />,
      );
    });
    await screen.findByTestId("content");
    expect(screen.getByText("Plugin Renderer")).toBeInTheDocument();
    expect(screen.getByText("Debug Stub")).toBeInTheDocument();
    expect(screen.getByText("stub.x")).toBeInTheDocument();
  });
});

// ─── error path ───────────────────────────────────────────────────────────

describe("PluginPreviewRenderer load failures", () => {
  // Silence the deliberate componentDidCatch console.warn so a failing
  // load doesn't pollute the test output. Restored after each test.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("renders the error fallback when plugin.load() rejects", async () => {
    const stub = stubPlugin("pdf", {
      loadError: new Error("boom-load-error"),
    });
    const registry = createPreviewPluginRegistry([stub.plugin]);
    const onError = vi.fn();

    await act(async () => {
      render(
        <PluginPreviewRenderer
          file={mockFile("pdf")}
          registry={registry}
          onError={onError}
        />,
      );
    });

    // PreviewFallback shows the failedToLoadPreview title from zhCN
    expect(await screen.findByText(/预览加载失败/)).toBeInTheDocument();
    // and a Retry button
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RENDER_FAILED" }),
    );
  });
});

// ─── load caching ─────────────────────────────────────────────────────────

describe("PluginPreviewRenderer load caching", () => {
  it("calls plugin.load only once across re-renders of the same plugin", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);
    const fileA = mockFile("pdf");
    const fileB = mockFile("pdf");

    let utils: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <PluginPreviewRenderer file={fileA} registry={registry} />,
      );
    });
    await screen.findByTestId("content");

    await act(async () => {
      utils!.rerender(
        <PluginPreviewRenderer file={fileB} registry={registry} />,
      );
    });
    await screen.findByTestId("content");

    // promiseCache is keyed by plugin identity, so a second render with the
    // same plugin reuses the resolved module.
    expect(stub.load).toHaveBeenCalledOnce();
  });
});

// ─── large file policy (built-in LargeFileGate) ───────────────────────────

describe("PluginPreviewRenderer large-file policy", () => {
  const BLOCK = 100 * 1024 * 1024; // 100 MB → block threshold
  const CONFIRM = 50 * 1024 * 1024; // 50 MB → confirm threshold

  function largeFile(fileType: FileType, size: number): FileInfo {
    return {
      id: `large-${fileType}-${size}`,
      name: `large.${fileType}`,
      size,
      type: "",
      fileType,
      source: { kind: "blob", blob: new Blob(["mock"]) },
    };
  }

  it("blocks preview for files >= 100 MB and offers download instead", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      render(
        <PluginPreviewRenderer
          file={largeFile("pdf", BLOCK)}
          registry={registry}
        />,
      );
    });

    // Block UI: title + download button, and the plugin must NOT have loaded.
    expect(screen.getByText(/too large to preview/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download original file/i }),
    ).toBeInTheDocument();
    expect(stub.load).not.toHaveBeenCalled();
  });

  it("requires confirmation before previewing a 50–100 MB file", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      render(
        <PluginPreviewRenderer
          file={largeFile("pdf", CONFIRM)}
          registry={registry}
        />,
      );
    });

    // Confirm prompt visible; plugin not loaded yet.
    expect(screen.getByText(/large file preview/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview anyway/i })).toBeInTheDocument();
    expect(stub.load).not.toHaveBeenCalled();

    // User confirms → preview loads.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /preview anyway/i }));
    });
    await screen.findByTestId("content");
    expect(stub.load).toHaveBeenCalledOnce();
  });

  it("disables the gate when largeFilePolicy=\"off\"", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      render(
        <PluginPreviewRenderer
          file={largeFile("pdf", BLOCK)}
          registry={registry}
          largeFilePolicy="off"
        />,
      );
    });

    // No block UI — the preview loads straight through.
    await screen.findByTestId("content");
    expect(screen.queryByText(/too large to preview/i)).not.toBeInTheDocument();
  });
});

