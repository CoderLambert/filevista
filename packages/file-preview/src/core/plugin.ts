import type { ComponentType } from "react";
import type { FileInfo } from "../utils";
import { PreviewError } from "./preview-error";

/**
 * Props passed to every preview adapter component loaded via PreviewPlugin.
 *
 * `reportError` lets adapters surface non-throwing failures (e.g. PPTX
 * rendering that recovers via a degraded fallback) to the top-level
 * `PluginPreviewRenderer.onError` listener — without forcing a render
 * failure through the React error boundary.
 */
export interface PreviewAdapterProps {
  file: FileInfo;
  reportError?: (error: PreviewError) => void;
}

export interface PreviewPlugin {
  id: string;
  name: string;
  priority?: number;
  match(file: FileInfo): boolean;
  load(): Promise<{ default: ComponentType<PreviewAdapterProps> }>;
}

/**
 * Wrap a dynamic-import loader so that, if the import fails because an
 * optional peer dependency is missing (e.g. `pdfjs-dist`, `exceljs`), the
 * user sees a clear "install this package" message instead of the raw
 * bundler error.
 *
 * @example
 * load: loadWithOptionalDep(
 *   () => import("../preview-adapters/PdfPreviewAdapter"),
 *   { package: "pdfjs-dist", featureLabel: "PDF preview" },
 * )
 */
export function loadWithOptionalDep<T>(
  loader: () => Promise<T>,
  meta: { package: string; featureLabel: string },
): () => Promise<T> {
  return async () => {
    try {
      return await loader();
    } catch (cause) {
      if (isModuleNotFoundError(cause, meta.package)) {
        throw new MissingPeerDependencyError(meta.package, meta.featureLabel, cause);
      }
      throw cause;
    }
  };
}

export class MissingPeerDependencyError extends PreviewError {
  constructor(
    public packageName: string,
    public featureLabel: string,
    cause: unknown,
  ) {
    super(
      "MISSING_PEER_DEPENDENCY",
      `${featureLabel} requires the optional peer dependency "${packageName}".\n\n` +
        `Install it in your app:\n` +
        `  pnpm add ${packageName}\n` +
        `  # or: npm install ${packageName}\n` +
        `  # or: yarn add ${packageName}\n\n` +
        `See: https://github.com/CoderLambert/filevista/tree/main/packages/file-preview#optional-peer-dependencies`,
      { cause, details: { packageName, featureLabel } },
    );
    this.name = "MissingPeerDependencyError";
  }
}

/**
 * Detect "module not found" failures across the bundlers/runtimes our users
 * are likely on — Webpack, Turbopack, Vite, native ESM, esbuild.
 *
 * We deliberately match loosely. False positives are cheap (the install hint
 * is always actionable) but false negatives swallow the affordance.
 */
function isModuleNotFoundError(error: unknown, packageName: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? "";
  if (!message) return false;

  // The package name must appear in the message — otherwise we're attributing
  // an unrelated error to the wrong dependency.
  if (!message.includes(packageName)) return false;

  return (
    message.includes("Cannot find module") || // Node ESM, Webpack
    message.includes("Failed to fetch dynamically imported module") || // Native browser ESM
    message.includes("Failed to resolve module specifier") || // Vite dev
    message.includes("Module not found") || // Webpack production
    message.includes("Unable to resolve") // Metro / some bundlers
  );
}
