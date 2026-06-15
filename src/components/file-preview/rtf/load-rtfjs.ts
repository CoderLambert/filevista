/**
 * Dynamically load rtf.js bundle scripts (WMFJS, EMFJS, RTFJS).
 *
 * The npm module `import 'rtf.js'` does not work correctly in
 * Next.js/Turbopack. Instead, the bundle.js files are copied to
 * `public/vendor/rtfjs/` and loaded via static <script> tags.
 *
 * Each bundle exposes its respective global on `window`:
 *   WMFJS → window.WMFJS
 *   EMFJS → window.EMFJS
 *   RTFJS → window.RTFJS
 *
 * Bundles are loaded only once; subsequent calls return a cached promise.
 */

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

const BUNDLE_FILES = [
  "vendor/rtfjs/WMFJS.bundle.min.js",
  "vendor/rtfjs/EMFJS.bundle.min.js",
  "vendor/rtfjs/RTFJS.bundle.min.js",
] as const;

let loadingPromise: Promise<RtfJsGlobals> | null = null;

export function loadRtfJsGlobals(): Promise<RtfJsGlobals> {
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = load();

  return loadingPromise;
}

/**
 * Resolve a public path, respecting NEXT_PUBLIC_BASE_PATH if configured.
 */
function resolvePath(path: string): string {
  const basePath =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BASE_PATH || "" : "";
  return `${basePath}/${path}`;
}

async function load(): Promise<RtfJsGlobals> {
  for (const file of BUNDLE_FILES) {
    await loadScript(resolvePath(file));
  }

  if (!window.RTFJS) {
    throw new Error(
      "RTFJS global is not available after loading RTFJS.bundle.min.js",
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
