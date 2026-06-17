const NONE_BACKGROUND = { type: "none" } as const;

type PptxLikeBackground = { type?: string } | null | undefined;

type PptxLikeSlideMaster = {
  background?: PptxLikeBackground;
  nodes?: unknown[];
};

type PptxLikeSlideLayout = {
  background?: PptxLikeBackground;
  nodes?: unknown[];
  slideMaster?: PptxLikeSlideMaster;
};

type PptxLikeSlide = {
  background?: PptxLikeBackground;
  nodes?: unknown[];
  slideLayout?: PptxLikeSlideLayout;
};

type PptxLikeDocument = {
  slides?: PptxLikeSlide[];
};

function ensureBackground<T extends { background?: PptxLikeBackground }>(
  target: T | null | undefined
) {
  if (!target) return;
  if (!target.background || typeof target.background !== "object") {
    target.background = { ...NONE_BACKGROUND };
  }
}

function ensureNodes<T extends { nodes?: unknown[] }>(target: T | null | undefined) {
  if (!target) return;
  if (!Array.isArray(target.nodes)) {
    target.nodes = [];
  }
}

export function normalizePptxPreviewModel(pptx: PptxLikeDocument | null | undefined) {
  if (!pptx || !Array.isArray(pptx.slides)) return;

  pptx.slides.forEach((slide) => {
    ensureBackground(slide);
    ensureNodes(slide);

    if (!slide.slideLayout) {
      slide.slideLayout = {};
    }

    ensureBackground(slide.slideLayout);
    ensureNodes(slide.slideLayout);

    if (!slide.slideLayout.slideMaster) {
      slide.slideLayout.slideMaster = {};
    }

    ensureBackground(slide.slideLayout.slideMaster);
    ensureNodes(slide.slideLayout.slideMaster);
  });
}
