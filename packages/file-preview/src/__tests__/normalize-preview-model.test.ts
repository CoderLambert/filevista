import { describe, expect, it } from "vitest";
import { normalizePptxPreviewModel } from "../pptx/normalize-preview-model";

describe("normalizePptxPreviewModel", () => {
  it("fills in missing slide layout, slide master, backgrounds, and nodes", () => {
    const pptx = {
      slides: [{}],
    };

    normalizePptxPreviewModel(pptx);

    expect(pptx.slides[0]).toMatchObject({
      background: { type: "none" },
      nodes: [],
      slideLayout: {
        background: { type: "none" },
        nodes: [],
        slideMaster: {
          background: { type: "none" },
          nodes: [],
        },
      },
    });
  });

  it("preserves existing backgrounds and nodes", () => {
    const existingBackground = { type: "solidFill", color: "#ffffff" };
    const existingNodes = [{ id: 1 }];
    const pptx = {
      slides: [
        {
          background: existingBackground,
          nodes: existingNodes,
          slideLayout: {
            background: existingBackground,
            nodes: existingNodes,
            slideMaster: {
              background: existingBackground,
              nodes: existingNodes,
            },
          },
        },
      ],
    };

    normalizePptxPreviewModel(pptx);

    expect(pptx.slides[0].background).toBe(existingBackground);
    expect(pptx.slides[0].nodes).toBe(existingNodes);
    expect(pptx.slides[0].slideLayout?.background).toBe(existingBackground);
    expect(pptx.slides[0].slideLayout?.nodes).toBe(existingNodes);
    expect(pptx.slides[0].slideLayout?.slideMaster?.background).toBe(
      existingBackground
    );
    expect(pptx.slides[0].slideLayout?.slideMaster?.nodes).toBe(existingNodes);
  });
});
