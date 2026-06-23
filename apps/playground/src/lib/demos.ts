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
  { name: string; type: string; content: string; size: number }[]
> {
  const results: { name: string; type: string; content: string; size: number }[] = [];

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

      if (
        normalizedHead.startsWith("<!doctype html") ||
        normalizedHead.startsWith("<html")
      ) {
        console.error(
          `Demo file returned HTML instead of binary data: ${entry.name}`,
          url,
        );
        continue;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const content = result.split(",")[1];
          if (!content) {
            reject(new Error(`Invalid data URL for demo file: ${entry.name}`));
            return;
          }
          resolve(content);
        };
        reader.onerror = () => {
          reject(reader.error ?? new Error(`Failed to read: ${entry.name}`));
        };
        reader.readAsDataURL(blob);
      });

      results.push({
        name: entry.name,
        type: entry.type,
        content: base64,
        size: blob.size,
      });
    } catch (error) {
      console.error(`Failed to load demo file: ${entry.name}`, error);
    }
  }

  return results;
}
