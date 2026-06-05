/**
 * Dynamically load rtf.js bundle scripts (WMFJS, EMFJS, RTFJS).
 *
 * The npm module `import 'rtf.js'` does not work correctly in all
 * bundler environments. The official usage is to load the bundle.js
 * files from node_modules via <script> tags, which expose
 * `window.RTFJS`, `window.WMFJS`, `window.EMFJS`.
 *
 * This loader resolves bundle URLs at runtime using Next.js's
 * asset resolution (public/ or _next/static/media/) and ensures
 * each bundle is loaded only once.
 */

import wmfJsBundlePath from "rtf.js/dist/WMFJS.bundle.min.js";
import emfJsBundlePath from "rtf.js/dist/EMFJS.bundle.min.js";
import rtfJsBundlePath from "rtf.js/dist/RTFJS.bundle.min.js";

/** Minimal types for rtf.js globals exposed on window. */
interface RtfJsDocument {
  render(): Promise<HTMLElement[]>;
  setConfig(config: Record<string, unknown>): void;
}

interface RtfJsLibrary {
  Document: new (
    buffer: ArrayBuffer | Uint8Array,
    options?: Record<string, unknown>,
  ) => RtfJsDocument;
  loggingEnabled?: (enabled: boolean) => void;
}

type RtfJsGlobals = {
  RTFJS: RtfJsLibrary;
  WMFJS: { loggingEnabled?: (enabled: boolean) => void };
  EMFJS: { loggingEnabled?: (enabled: boolean) => void };
};

declare global {
  interface Window {
    RTFJS?: RtfJsGlobals["RTFJS"];
    WMFJS?: RtfJsGlobals["WMFJS"];
    EMFJS?: RtfJsGlobals["EMFJS"];
  }
}

let loadingPromise: Promise<RtfJsGlobals> | null = null;

export function loadRtfJsGlobals(): Promise<RtfJsGlobals> {
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = load();

  return loadingPromise;
}

/**
 * Resolve a module path import to a usable URL at runtime.
 * Next.js / Webpack / Turbopack may transform a bare import
 * differently — the safest approach is to use the module's
 * runtime-resolved path.
 */
function resolveBundleUrl(modulePath: string): string {
  // Next.js handles this as a JS asset import and gives us the
  // actual served URL path (e.g. /_next/static/chunks/...).
  return modulePath;
}

async function load(): Promise<RtfJsGlobals> {
  const wmfUrl = resolveBundleUrl(wmfJsBundlePath);
  const emfUrl = resolveBundleUrl(emfJsBundlePath);
  const rtfUrl = resolveBundleUrl(rtfJsBundlePath);

  await loadScript(wmfUrl);
  await loadScript(emfUrl);
  await loadScript(rtfUrl);

  if (!window.RTFJS) {
    throw new Error(
      "RTFJS global is not available after loading RTFJS.bundle.js",
    );
  }

  // Disable verbose console logging from the library
  window.RTFJS.loggingEnabled?.(false);
  window.WMFJS?.loggingEnabled?.(false);
  window.EMFJS?.loggingEnabled?.(false);

  return {
    RTFJS: window.RTFJS,
    WMFJS: window.WMFJS!,
    EMFJS: window.EMFJS!,
  };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded or loading
    const existed = document.querySelector<HTMLScriptElement>(
      `script[data-rtfjs-src="${src}"]`,
    );

    if (existed) {
      if (existed.dataset.loaded === "true") {
        resolve();
        return;
      }

      existed.addEventListener("load", () => resolve(), { once: true });
      existed.addEventListener(
        "error",
        () => reject(new Error(`Failed to load script: ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.rtfjsSrc = src;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };

    document.head.appendChild(script);
  });
}
