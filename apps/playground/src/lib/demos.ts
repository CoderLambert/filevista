// Demo files served from `apps/playground/public/demo/`.
//
// The list is auto-generated from the directory contents — see
// `scripts/sync-demos.mjs` and `demos.generated.ts`. To add a new demo,
// just drop the file into `public/demo/` and re-run `pnpm run sync:demos`
// (this also runs automatically before `pnpm run dev` / `pnpm run build`).

import { resolveAssetPath } from "@lamberl-lee/file-preview";
import { DEMO_FILE_ENTRIES } from "./demos.generated";

export const DEMO_BINARY_FILES: Record<
  string,
  { name: string; type: string; url: string }
> = Object.fromEntries(
  DEMO_FILE_ENTRIES.map((entry) => [
    entry.name,
    {
      name: entry.name,
      type: entry.type,
      url: resolveAssetPath(entry.path),
    },
  ])
);

/**
 * Fetch binary demo files and convert to FileInfo-compatible format.
 * Returns array of { name, type, content (base64), size } entries.
 */
export async function fetchBinaryDemoFiles(): Promise<
  { name: string; type: string; content: string; size: number }[]
> {
  const results: { name: string; type: string; content: string; size: number }[] = [];

  for (const demo of Object.values(DEMO_BINARY_FILES)) {
    try {
      const response = await fetch(demo.url);
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
        name: demo.name,
        type: demo.type,
        content: base64,
        size: blob.size,
      });
    } catch {
      // Skip files that fail to load
      console.warn(`Failed to load demo file: ${demo.name}`);
    }
  }

  return results;
}
