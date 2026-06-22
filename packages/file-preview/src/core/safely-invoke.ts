/**
 * Safely invoke a consumer callback, preventing it from throwing into the
 * internal control flow of FileVista.
 *
 * If the callback throws, the error is logged as a warning to the console
 * and swallowed — a consumer's onError/onReady/onSlideChange should never
 * be treated as a parse failure, trigger fallback logic, or escape from a
 * React effect/event handler.
 *
 * Use this anywhere a consumer-supplied function is invoked from inside
 * FileVista (PluginPreviewRenderer.onError, PreviewErrorBoundary.onError,
 * adapter `reportError`, plugin callbacks).
 */
export function safelyInvoke<T extends unknown[]>(
  callback: ((...args: T) => void) | undefined,
  ...args: T
): void {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.warn(
      "[FileVista] consumer callback threw an error",
      error,
    );
  }
}
