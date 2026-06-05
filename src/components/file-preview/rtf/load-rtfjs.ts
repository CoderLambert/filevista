/**
 * Dynamically load rtf.js bundle scripts (WMFJS, EMFJS, RTFJS).
 *
 * The npm module `import 'rtf.js'` does not work correctly in some
 * bundler environments. The official usage is to load the bundle.js
 * files which expose `window.RTFJS`, `window.WMFJS`, `window.EMFJS`.
 *
 * This loader ensures each bundle is loaded only once and returns the
 * globals via a shared promise.
 */

import wmfUrl from "rtf.js/dist/WMFJS.bundle.min.js?url";
import emfUrl from "rtf.js/dist/EMFJS.bundle.min.js?url";
import rtfUrl from "rtf.js/dist/RTFJS.bundle.min.js?url";

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

async function load(): Promise<RtfJsGlobals> {
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
