/**
 * Safely invoke a consumer callback, preventing it from throwing into the
 * internal control flow of FileVista.
 *
 * If the callback throws, the error is logged as a warning to the console
 * and swallowed — it must never be treated as a PPTX parse failure or
 * trigger fallback logic.
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