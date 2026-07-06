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
import type { ComponentType, ReactElement } from "react";
import { PluginPreviewRenderer } from "../PluginPreviewRenderer";
import { createPreviewPluginRegistry } from "../core/registry";
import type { PreviewPlugin } from "../core/plugin";
import type { FileInfo, FileType } from "../core/types";
import { LocaleProvider, zhCN } from "../core/i18n";

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
  const BLOCK = 100 * 1024 * 1024 + 1; // 100 MB + 1 byte → block threshold exceeded
  const CONFIRM = 50 * 1024 * 1024; // 50 MB → confirm threshold
  const MB = 1024 * 1024;

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

  // Pin locale to zh-CN so the text assertions below don't depend on the
  // package's default locale (which could change in the future).
  function renderWithLocale(ui: ReactElement) {
    return render(<LocaleProvider value={zhCN}>{ui}</LocaleProvider>);
  }

  it("blocks preview for files >= 100 MB and offers download instead", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      renderWithLocale(
        <PluginPreviewRenderer
          file={largeFile("pdf", BLOCK)}
          registry={registry}
        />,
      );
    });

    // Block UI: fallback rendered, and the plugin must NOT have loaded.
    expect(screen.getByText(/大文件/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /下载原文件/ }),
    ).toBeInTheDocument();
    expect(stub.load).not.toHaveBeenCalled();
  });

  it("requires confirmation before previewing a 50–100 MB file", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      renderWithLocale(
        <PluginPreviewRenderer
          file={largeFile("pdf", CONFIRM)}
          registry={registry}
        />,
      );
    });

    // Confirm prompt visible; plugin not loaded yet.
    expect(screen.getByText(/大文件预览/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /继续预览/ })).toBeInTheDocument();
    expect(stub.load).not.toHaveBeenCalled();

    // User confirms → preview loads.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /继续预览/ }));
    });
    await screen.findByTestId("content");
    expect(stub.load).toHaveBeenCalledOnce();
  });

  it("disables the gate when largeFilePolicy=\"off\"", async () => {
    const stub = stubPlugin("pdf");
    const registry = createPreviewPluginRegistry([stub.plugin]);

    await act(async () => {
      renderWithLocale(
        <PluginPreviewRenderer
          file={largeFile("pdf", BLOCK)}
          registry={registry}
          largeFilePolicy="off"
        />,
      );
    });

    // No block UI — the preview loads straight through.
    await screen.findByTestId("content");
    expect(screen.queryByText(/大文件/)).not.toBeInTheDocument();
  });

  describe("custom largeFilePolicy", () => {
    it("does not load plugin when custom maxBytes limit is exceeded", async () => {
      const load = vi.fn(async () => ({
        default: ({ file }: { file: FileInfo }) => (
          <div data-testid="content">{file.name}</div>
        ),
      }));

      const registry = createPreviewPluginRegistry([
        {
          id: "test-plugin",
          name: "Test",
          priority: 100,
          match: () => true,
          load,
        },
      ]);

      await act(async () => {
        renderWithLocale(
          <PluginPreviewRenderer
            file={largeFile("pdf", 51 * MB)}
            registry={registry}
            largeFilePolicy={{ maxBytes: 50 * MB }}
          />,
        );
      });

      expect(load).not.toHaveBeenCalled();
      expect(screen.getByText(/大文件/)).toBeInTheDocument();
    });

    it("loads plugin when file is within custom maxBytes", async () => {
      const load = vi.fn(async () => ({
        default: ({ file }: { file: FileInfo }) => (
          <div data-testid="content">{file.name}</div>
        ),
      }));

      const registry = createPreviewPluginRegistry([
        {
          id: "test-plugin",
          name: "Test",
          priority: 100,
          match: () => true,
          load,
        },
      ]);

      await act(async () => {
        renderWithLocale(
          <PluginPreviewRenderer
            file={largeFile("pdf", 30 * MB)}
            registry={registry}
            largeFilePolicy={{ maxBytes: 50 * MB }}
          />,
        );
      });

      await screen.findByTestId("content");
      expect(load).toHaveBeenCalledOnce();
    });

    it("reports FILE_TOO_LARGE error on block", async () => {
      const onError = vi.fn();
      const registry = createPreviewPluginRegistry([]);

      await act(async () => {
        renderWithLocale(
          <PluginPreviewRenderer
            file={largeFile("pdf", 51 * MB)}
            registry={registry}
            largeFilePolicy={{ maxBytes: 50 * MB }}
            onError={onError}
          />,
        );
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "FILE_TOO_LARGE" }),
      );
    });

    it("renders custom large file fallback when renderLargeFileFallback is set", async () => {
      const registry = createPreviewPluginRegistry([]);

      await act(async () => {
        renderWithLocale(
          <PluginPreviewRenderer
            file={largeFile("pdf", 51 * MB)}
            registry={registry}
            largeFilePolicy={{ maxBytes: 50 * MB }}
            renderLargeFileFallback={({ file, maxBytes }) => (
              <div data-testid="custom-fallback">
                {file.name} exceeds {maxBytes}
              </div>
            )}
          />,
        );
      });

      expect(screen.getByTestId("custom-fallback")).toHaveTextContent(
        `large.pdf exceeds ${50 * MB}`,
      );
    });

    it("with tiered policy: warns and confirms before blocking", async () => {
      const stub = stubPlugin("pdf");
      const registry = createPreviewPluginRegistry([stub.plugin]);

      // File within confirm range
      await act(async () => {
        renderWithLocale(
          <PluginPreviewRenderer
            file={largeFile("pdf", 35 * MB)}
            registry={registry}
            largeFilePolicy={{
              warningBytes: 20 * MB,
              confirmBytes: 30 * MB,
              maxBytes: 50 * MB,
            }}
          />,
        );
      });

      // Confirm prompt should show
      expect(screen.getByText(/大文件预览/)).toBeInTheDocument();
      expect(stub.load).not.toHaveBeenCalled();

      // Confirm
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /继续预览/ }));
      });
      await screen.findByTestId("content");
      expect(stub.load).toHaveBeenCalledOnce();
    });
  });
});

