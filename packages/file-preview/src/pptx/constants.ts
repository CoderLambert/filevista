export const PPTX_MIN_ZOOM = 50;
export const PPTX_MAX_ZOOM = 200;
export const PPTX_ZOOM_STEP = 10;

/**
 * Hard limits applied to the degraded fallback parsers (insight + semantic).
 *
 * The upstream `RECOMMENDED_ZIP_LIMITS` from `@aiden0z/pptx-renderer` already
 * defends against zip bombs at the archive level. These tighter limits
 * defend against synchronous main-thread stalls when a PPTX legitimately
 * contains hundreds of slides or megabytes of slide XML — neither of which
 * is a zip-bomb, but both of which would freeze the tab if the fallback
 * parses every slide synchronously.
 *
 * The viewer path is unaffected — only fallback (degraded) parsing uses these.
 */
export const PPTX_FALLBACK_LIMITS = {
  maxSlides: 200,
  maxXmlBytesPerSlide: 4 * 1024 * 1024,
  maxTotalXmlBytes: 32 * 1024 * 1024,
  maxTextItemsPerSlide: 1_000,
  yieldEverySlides: 8,
} as const;
