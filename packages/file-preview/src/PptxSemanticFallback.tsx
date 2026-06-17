import { AlertTriangleIcon } from "./icons";
import { useLocale } from "./core/i18n";
import type { PptxSemanticDeck, PptxSemanticElement } from "./pptx/types";
import "./styles/PptxSemanticFallback.css";

function alignItemsFor(verticalAlign: "top" | "center" | "bottom") {
  if (verticalAlign === "center") return "center";
  if (verticalAlign === "bottom") return "flex-end";
  return "flex-start";
}

function justifyContentFor(align: "left" | "center" | "right") {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

function renderElement(
  element: PptxSemanticElement,
  index: number,
  slideWidth: number,
  slideHeight: number
) {
  const style = {
    left: `${(element.x / slideWidth) * 100}%`,
    top: `${(element.y / slideHeight) * 100}%`,
    width: `${(element.width / slideWidth) * 100}%`,
    height: `${(element.height / slideHeight) * 100}%`,
  };

  if (element.kind === "shape") {
    return (
      <div
        key={index}
        className="fv-pptx-semantic__shape"
        style={{
          ...style,
          background: element.fill,
        }}
      />
    );
  }

  return (
    <div
      key={index}
      className="fv-pptx-semantic__text"
      style={{
        ...style,
        color: element.color,
        fontSize: `${Math.max(10, element.fontSize * 0.72)}px`,
        fontWeight: element.bold ? 700 : 400,
        fontStyle: element.italic ? "italic" : "normal",
        alignItems: alignItemsFor(element.verticalAlign),
        justifyContent: justifyContentFor(element.align),
        textAlign: element.align,
      }}
    >
      {element.text.split("\n").map((line, lineIndex) => (
        <span key={lineIndex}>{line}</span>
      ))}
    </div>
  );
}

export function PptxSemanticFallback({
  deck,
  error,
}: {
  deck: PptxSemanticDeck;
  error?: Error | null;
}) {
  const t = useLocale();

  return (
    <div className="fv-pptx-semantic">
      <div className="fv-pptx-semantic__notice">
        <AlertTriangleIcon size={20} className="fv-pptx-semantic__notice-icon" />
        <div>
          <strong>{t.previewFailed}</strong>
          <span className="fv-pptx-semantic__notice-desc">
            {error?.message || "High-fidelity preview unavailable. Showing slide fallback."}
          </span>
        </div>
      </div>

      <div className="fv-pptx-semantic__meta">
        <span className="fv-pptx-semantic__meta-item">{deck.title}</span>
        <span className="fv-pptx-semantic__meta-sep">·</span>
        <span className="fv-pptx-semantic__meta-item">
          {deck.slides.length} {t.pages}
        </span>
      </div>

      <div className="fv-pptx-semantic__slides">
        {deck.slides.map((slide, slideIndex) => (
          <section key={slideIndex} className="fv-pptx-semantic__slide-block">
            <div className="fv-pptx-semantic__slide-header">
              <h3 className="fv-pptx-semantic__slide-title">
                {slideIndex + 1}. {slide.title}
              </h3>
            </div>

            <div
              className="fv-pptx-semantic__slide-canvas"
              style={{ background: slide.background }}
            >
              {slide.elements.map((element, elementIndex) =>
                renderElement(element, elementIndex, deck.width, deck.height)
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
