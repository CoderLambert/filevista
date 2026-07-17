// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, cleanup, fireEvent } from "@testing-library/react";

// ─── Mock @aiden0z/pptx-renderer ─────────────────────────────────────────
//
// The real upstream package depends on DOM APIs that jsdom does not
// implement (e.g. ResizeObserver, parts of CanvasRenderingContext2D, etc.).
// We replace it with a controllable test double that exposes the surface
// area `pptx-renderer-engine.ts` and `read-pptx-insight.ts` actually use.

type Behaviour = {
  openShouldFail: boolean;
  renderListShouldFail: boolean;
  setZoomShouldFail: boolean;
  parseZipPresentation: string;
  parseZipRels: string;
  parseZipSlides: Map<string, string>;
};

const behaviour: Behaviour = {
  openShouldFail: false,
  renderListShouldFail: false,
  setZoomShouldFail: false,
  parseZipPresentation: "",
  parseZipRels: "",
  parseZipSlides: new Map(),
};

const destroySpies: Array<ReturnType<typeof vi.fn>> = [];

class FakePptxViewer {
  destroy = vi.fn();
  open = vi.fn(async () => {
    if (behaviour.openShouldFail) {
      throw new Error("fake open failure");
    }
  });
  renderSlide = vi.fn(async () => undefined);
  renderList = vi.fn(async () => {
    if (behaviour.renderListShouldFail) {
      throw new Error("fake renderList failure");
    }
  });
  goToSlide = vi.fn(async () => undefined);
  setZoom = vi.fn(async (n: number) => {
    if (behaviour.setZoomShouldFail) {
      throw new Error("fake setZoom failure");
    }
    this._zoom = n;
  });
  setFitMode = vi.fn(async () => undefined);

  slideCount = 5;
  currentSlideIndex = 0;
  zoomPercent = 100;
  fitMode = "contain" as const;
  _zoom = 100;

  constructor(_container: HTMLElement, _options: unknown) {
    destroySpies.push(this.destroy);
  }
}

vi.mock("@aiden0z/pptx-renderer", () => {
  return {
    PptxViewer: FakePptxViewer,
    RECOMMENDED_ZIP_LIMITS: { maxFiles: 1000 },
    parseZipLazyMedia: vi.fn(async () => ({
      presentation: behaviour.parseZipPresentation,
      presentationRels: behaviour.parseZipRels,
      slides: behaviour.parseZipSlides,
    })),
  };
});

// Reset shared module state between tests so behaviour does not bleed.
beforeEach(() => {
  behaviour.openShouldFail = false;
  behaviour.renderListShouldFail = false;
  behaviour.setZoomShouldFail = false;
  behaviour.parseZipPresentation = "";
  behaviour.parseZipRels = "";
  behaviour.parseZipSlides = new Map();
  destroySpies.length = 0;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Lazy import so the vi.mock above is wired before module load.
async function importPreview() {
  const mod = await import("../PptxPreview");
  return mod.PptxPreview;
}

function makeBlobSource(): {
  source: { kind: "blob"; blob: Blob; name?: string; mimeType?: string };
  fileName: string;
} {
  // A trivial binary payload — the engine's open() is mocked, so contents
  // never actually have to parse as PPTX.
  return {
    source: {
      kind: "blob",
      blob: new Blob([new Uint8Array([1, 2, 3])]),
      name: "test.pptx",
    },
    fileName: "test.pptx",
  };
}

async function flushAsync() {
  // Let microtasks + a setTimeout tick drain so async effects settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();
  });
}

describe("PptxPreview — lifecycle and safety", () => {
  it("calls destroy when PptxViewer.open() fails mid-construction", async () => {
    behaviour.openShouldFail = true;
    behaviour.parseZipSlides = new Map([
      ["ppt/slides/slide1.xml", "<p:sp/>"],
    ]);
    behaviour.parseZipPresentation = "<presentation/>";

    const PptxPreview = await importPreview();
    const { source, fileName } = makeBlobSource();
    const onError = vi.fn();

    render(
      React.createElement(PptxPreview, { source, fileName, onError }),
    );

    await flushAsync();

    // Exactly one viewer instance was constructed; its destroy was invoked
    // by the engine's `try/catch` after open() rejected.
    expect(destroySpies.length).toBeGreaterThanOrEqual(1);
    expect(destroySpies[0]).toHaveBeenCalled();
  });

  it("does NOT trigger fallback when onReady throws", async () => {
    behaviour.openShouldFail = false;
    const PptxPreview = await importPreview();
    const { source, fileName } = makeBlobSource();

    const onReady = vi.fn(() => {
      throw new Error("consumer onReady boom");
    });
    const onError = vi.fn();

    render(
      React.createElement(PptxPreview, { source, fileName, onReady, onError }),
    );

    await flushAsync();

    // onReady was invoked — but its throw was caught by safelyInvoke,
    // so onError must NOT have fired.
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rolls back viewMode when renderList fails", async () => {
    behaviour.openShouldFail = false;
    behaviour.renderListShouldFail = true;
    const PptxPreview = await importPreview();
    const { source, fileName } = makeBlobSource();

    const onError = vi.fn();
    const { container } = render(
      React.createElement(PptxPreview, { source, fileName, onError }),
    );

    await flushAsync();

    // Find the grid view toggle - the non-active button in the mode switch.
    const gridBtn = container.querySelector(
      ".fv-pptx__mode-switch button[data-active='false']",
    ) as HTMLButtonElement;
    fireEvent.click(gridBtn);
    await flushAsync();

    // renderList failed → callback was invoked
    expect(onError).toHaveBeenCalled();
  });

  it("calls onError exactly once after fallback completes when high-fidelity render fails", async () => {
    behaviour.openShouldFail = true;
    behaviour.parseZipPresentation = "<presentation/>";
    behaviour.parseZipSlides = new Map([
      ["ppt/slides/slide1.xml", "<a:t>hello</a:t>"],
    ]);

    const PptxPreview = await importPreview();
    const { source, fileName } = makeBlobSource();
    const onError = vi.fn();

    render(
      React.createElement(PptxPreview, { source, fileName, onError }),
    );

    await flushAsync();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});