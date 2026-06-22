"use client";

import { AlertTriangleIcon } from "./icons";
import { useLocale } from "./core/i18n";
import type { PptxInsight } from "./pptx/types";
import "./styles/PptxSummaryFallback.css";

/**
 * Fallback component shown when high-fidelity PPTX rendering fails.
 * Displays a structural summary (slide titles, text snippets, image counts)
 * extracted directly from the PPTX XML so the user can still see the
 * file's content even when the renderer can't handle it.
 */
export function PptxSummaryFallback({
  insight,
  error,
}: {
  insight: PptxInsight;
  error?: Error | null;
}) {
  const t = useLocale();

  return (
    <div className="fv-pptx-summary">
      <div className="fv-pptx-summary__notice">
        <AlertTriangleIcon size={20} className="fv-pptx-summary__notice-icon" />
        <div>
          <strong>{t.pptxFallbackTitle}</strong>
          <span className="fv-pptx-summary__notice-desc">
            {t.pptxFallbackSummaryDesc}
          </span>
          {error?.message && (
            <details className="fv-pptx-summary__notice-details">
              <summary>{t.fallbackErrorDetails}</summary>
              <code>{error.message}</code>
            </details>
          )}
        </div>
      </div>

      <div className="fv-pptx-summary__meta">
        <span className="fv-pptx-summary__meta-item">
          {insight.title}
        </span>
        <span className="fv-pptx-summary__meta-sep">·</span>
        <span className="fv-pptx-summary__meta-item">
          {insight.slideCount} {t.pages}
        </span>
        <span className="fv-pptx-summary__meta-sep">·</span>
        <span className="fv-pptx-summary__meta-item">
          {insight.imageCount} {t.pptxFallbackImages}
        </span>
      </div>

      <div className="fv-pptx-summary__slides">
        {insight.slides.map((slide, index) => (
          <section key={index} className="fv-pptx-summary__slide">
            <h3 className="fv-pptx-summary__slide-title">
              {index + 1}. {slide.title}
            </h3>
            <p className="fv-pptx-summary__slide-stats">
              {slide.textCount} {t.pptxFallbackTextBlocks}, {slide.imageCount} {t.pptxFallbackImages}
            </p>
            {slide.sampleTexts.length > 0 && (
              <ul className="fv-pptx-summary__slide-texts">
                {slide.sampleTexts.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
