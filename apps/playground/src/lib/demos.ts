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
      if (!response.ok) continue;

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:...;base64, prefix
        };
        reader.readAsDataURL(blob);
      });

      results.push({
        name: entry.name,
        type: entry.type,
        content: base64,
        size: blob.size,
      });
    } catch {
      // Skip files that fail to load
      console.warn(`Failed to load demo file: ${entry.name}`);
    }
  }

  return results;
}
