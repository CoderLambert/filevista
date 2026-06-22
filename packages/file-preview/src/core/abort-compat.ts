/**
 * Browser-compatible replacement for `AbortSignal.prototype.throwIfAborted()`.
 *
 * `AbortSignal.throwIfAborted()` is not available on Safari before ~15.4 and
 * Chrome before ~100 (Q2 2022). FileVista documents browser support from
 * Chrome 90 / Safari 14+ / Firefox 88+, so this compat function is used
 * everywhere instead of the native method.
 */
export function throwIfAbortedCompat(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted", "AbortError");
}