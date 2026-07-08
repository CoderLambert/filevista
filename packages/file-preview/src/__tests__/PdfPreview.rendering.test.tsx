// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeRenderTask = {
  scale: number;
  promise: Promise<void>;
  cancel: ReturnType<typeof vi.fn>;
  resolve: () => void;
  rejectCancel: () => void;
};

const renderTasks: FakeRenderTask[] = [];

function renderingCancelledError() {
  return Object.assign(new Error("rendering cancelled"), {
    name: "RenderingCancelledException",
  });
}

function createRenderTask(scale: number): FakeRenderTask {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const task: FakeRenderTask = {
    scale,
    promise,
    cancel: vi.fn(),
    resolve,
    rejectCancel: () => reject(renderingCancelledError()),
  };
  renderTasks.push(task);
  return task;
}

vi.mock("pdfjs-dist", () => {
  const page = {
    getViewport: vi.fn(({ scale }: { scale: number }) => ({
      width: Math.round(scale * 100),
      height: Math.round(scale * 200),
    })),
    render: vi.fn(({ viewport }: { viewport: { width: number } }) =>
      createRenderTask(viewport.width / 100)
    ),
  };

  return {
    GlobalWorkerOptions: {},
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(() => Promise.resolve(page)),
        destroy: vi.fn(() => Promise.resolve()),
      }),
    })),
  };
});

beforeEach(() => {
  renderTasks.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 1,
  });
});

async function importPreview() {
  const mod = await import("../PdfPreview");
  return mod.PdfPreview;
}

async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("PdfPreview rendering", () => {
  it("keeps stale render tasks from overwriting the latest zoom render", async () => {
    const PdfPreview = await importPreview();

    render(
      <PdfPreview
        fileName="doc.pdf"
        source={{
          kind: "blob",
          blob: new Blob([new Uint8Array([1, 2, 3])], {
            type: "application/pdf",
          }),
        }}
      />,
    );

    await flushAsync();
    expect(renderTasks).toHaveLength(1);

    fireEvent.click(screen.getByTitle("Zoom In"));
    await flushAsync();
    expect(renderTasks).toHaveLength(2);
    expect(renderTasks[0]?.cancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderTasks[0]?.rejectCancel();
    });

    fireEvent.click(screen.getByTitle("Zoom In"));
    await flushAsync();
    expect(renderTasks).toHaveLength(3);
    expect(renderTasks[1]?.cancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderTasks[2]?.resolve();
    });
    await act(async () => {
      renderTasks[1]?.resolve();
    });

    const canvas = document.querySelector(".fv-pdf__canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(400);
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("uses CSS size for zoom while keeping a high-DPI backing canvas", async () => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });

    const PdfPreview = await importPreview();

    render(
      <PdfPreview
        fileName="doc.pdf"
        source={{
          kind: "blob",
          blob: new Blob([new Uint8Array([1, 2, 3])], {
            type: "application/pdf",
          }),
        }}
      />,
    );

    await flushAsync();
    renderTasks[0]?.resolve();
    await flushAsync();

    fireEvent.click(screen.getByTitle("Zoom Out"));
    await flushAsync();
    renderTasks[1]?.resolve();
    await flushAsync();

    fireEvent.click(screen.getByTitle("Zoom Out"));
    await flushAsync();
    renderTasks[2]?.resolve();
    await flushAsync();

    fireEvent.click(screen.getByTitle("Zoom Out"));
    await flushAsync();
    renderTasks[3]?.resolve();
    await flushAsync();

    fireEvent.click(screen.getByTitle("Zoom Out"));
    await flushAsync();
    renderTasks[4]?.resolve();
    await flushAsync();

    const canvas = document.querySelector(".fv-pdf__canvas") as HTMLCanvasElement;
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(canvas.style.width).toBe("50px");
    expect(canvas.style.height).toBe("100px");
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(200);
  });
});
