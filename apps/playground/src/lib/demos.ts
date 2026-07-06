// Demo files served from `apps/playground/public/demo/`.
//
// The list is auto-generated from the directory contents — see
// `scripts/sync-demos.mjs` and `demos.generated.ts`. To add a new demo,
// just drop the file into `public/demo/` and re-run `pnpm run sync:demos`
// (this also runs automatically before `pnpm run dev` / `pnpm run build`).

import { resolveAssetPath } from "@lamberl-lee/file-preview";
import { DEMO_FILE_ENTRIES } from "./demos.generated";

/**
 * Fetch binary demo files and convert to FileInfo-compatible format.
 * Returns array of { name, type, content (base64), size } entries.
 *
 * Note: `resolveAssetPath` is called lazily inside this function rather than
 * at module scope, because `setAssetBasePath` is called in `page.tsx` after
 * module evaluation. On GitHub Pages the base path (/filevista) must be
 * applied; resolving at call time ensures it is.
 */
export async function fetchBinaryDemoFiles(): Promise<
  {
    name: string;
    type: string;
    content: string;
    size: number;
    /** "base64" — opaque binary; "utf8" — text content already decoded. */
    encoding: "base64" | "utf8";
  }[]
> {
  const results: {
    name: string;
    type: string;
    content: string;
    size: number;
    encoding: "base64" | "utf8";
  }[] = [];

  for (const entry of DEMO_FILE_ENTRIES) {
    try {
      const url = resolveAssetPath(entry.path);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          `Failed to fetch demo file: ${entry.name}`,
          response.status,
          response.statusText,
          url,
        );
        continue;
      }

      const blob = await response.blob();

      const head = await blob.slice(0, 256).text();
      const normalizedHead = head.trimStart().toLowerCase();

      if (normalizedHead.startsWith("version https://git-lfs.github.com/spec/v1")) {
        console.warn(`Skipping LFS pointer file: ${entry.name}`);
        continue;
      }

      // HTML files in /demo/ are valid preview targets (FileVista supports
      // HTML preview), but they must not be treated as opaque binary blobs —
      // encoding them as base64 → ArrayBuffer would lose the UTF-8 text
      // boundary and surface as a "binary" file in the demo list. Read them as
      // text and let the caller encode to UTF-8 bytes if it wants a buffer.
      const isHtml =
        normalizedHead.startsWith("<!doctype html") ||
        normalizedHead.startsWith("<html");

      const content = isHtml
        ? await blob.text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const dataUrl = result.split(",")[1];
              if (!dataUrl) {
                reject(new Error(`Invalid data URL for demo file: ${entry.name}`));
                return;
              }
              resolve(dataUrl);
            };
            reader.onerror = () => {
              reject(reader.error ?? new Error(`Failed to read: ${entry.name}`));
            };
            reader.readAsDataURL(blob);
          });

      results.push({
        name: entry.name,
        type: entry.type,
        content,
        size: blob.size,
        encoding: isHtml ? "utf8" : "base64",
      });
    } catch (error) {
      console.error(`Failed to load demo file: ${entry.name}`, error);
    }
  }

  return results;
}
