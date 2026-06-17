/**
 * FileVista runtime configuration.
 *
 * Library consumers can set these before mounting components,
 * or override them via `<FileVistaProvider>`.
 *
 * For now this is a simple module-level config; the Context-based
 * provider will be added in the next phase.
 */

/** Base path for static assets (PDF.js worker, RTF.js bundles, demo files). */
let assetBasePath = "";

/** Set the base path for static assets. Call once before mounting. */
export function setAssetBasePath(path: string): void {
  assetBasePath = path;
}

/** Get the current asset base path. */
export function getAssetBasePath(): string {
  return assetBasePath;
}

/** Resolve a public path against the configured base path. */
export function resolveAssetPath(path: string): string {
  if (!assetBasePath) return path;
  // Avoid double slash
  const base = assetBasePath.endsWith("/") ? assetBasePath.slice(0, -1) : assetBasePath;
  const relative = path.startsWith("/") ? path : `/${path}`;
  return `${base}${relative}`;
}
