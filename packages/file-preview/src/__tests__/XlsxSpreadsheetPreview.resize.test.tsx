// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reload = vi.fn();

class FakeSpreadsheet {
  sheet = { reload };
  bottombar = { swapFunc: vi.fn() };
  on = vi.fn();

  constructor(_host: HTMLElement, _options: unknown) {}

  loadData(_data: unknown) {
    return this;
  }
}

vi.mock("../excel/spreadsheet-loader", () => ({
  loadXDataSpreadsheet: vi.fn(async () => FakeSpreadsheet),
}));

type ResizeCallback = ResizeObserverCallback;

let resizeCallback: ResizeCallback;
const disconnect = vi.fn();
const observe = vi.fn();
let animationFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

class FakeResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

function notifyResize(width: number, height: number) {
  resizeCallback(
    [{ contentRect: { width, height } } as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

function flushAnimationFrames() {
  const queued = [...animationFrames.values()];
  animationFrames.clear();
  queued.forEach((callback) => callback(0));
}

async function flushMount() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  reload.mockClear();
  disconnect.mockClear();
  observe.mockClear();
  animationFrames = new Map();
  nextFrameId = 1;

  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => {
    animationFrames.delete(id);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("XlsxSpreadsheetPreview container resizing", () => {
  it("reloads the spreadsheet when a visible container changes size", async () => {
    const { XlsxSpreadsheetPreview } = await import("../XlsxSpreadsheetPreview");
    render(
      <XlsxSpreadsheetPreview
        data={{ sheets: [] }}
        activeSheet={0}
      />,
    );
    await flushMount();

    expect(observe).toHaveBeenCalledTimes(1);

    act(() => {
      notifyResize(900, 600);
      flushAnimationFrames();
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("waits for hidden containers to become visible and cleans up on unmount", async () => {
    const { XlsxSpreadsheetPreview } = await import("../XlsxSpreadsheetPreview");
    const view = render(
      <XlsxSpreadsheetPreview
        data={{ sheets: [] }}
        activeSheet={0}
      />,
    );
    await flushMount();

    act(() => {
      notifyResize(0, 0);
      flushAnimationFrames();
    });
    expect(reload).not.toHaveBeenCalled();

    act(() => {
      notifyResize(900, 600);
    });
    view.unmount();
    flushAnimationFrames();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
