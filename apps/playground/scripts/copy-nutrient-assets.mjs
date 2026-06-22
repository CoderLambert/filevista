/**
 * Copy Nutrient Web SDK assets into public/vendor/nutrient/.
 *
 * `@nutrient-sdk/viewer` is an optional dependency. If it's not installed,
 * this script is a no-op so the postinstall hook stays safe to run.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let viewerDir;
try {
  const viewerPath = require.resolve("@nutrient-sdk/viewer/package.json");
  viewerDir = path.dirname(viewerPath);
} catch {
  console.log(
    "[playground] @nutrient-sdk/viewer not installed — skipping Nutrient assets copy.",
  );
  process.exit(0);
}

const distDir = path.join(viewerDir, "dist");
const targetDir = path.resolve("public/vendor/nutrient");

if (!fs.existsSync(distDir)) {
  console.log(
    "[playground] Nutrient dist directory not found — skipping copy.",
  );
  process.exit(0);
}

// Remove existing target directory if it exists
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true });
}

// Copy the entire dist directory
fs.cpSync(distDir, targetDir, { recursive: true });

console.log(`Copied Nutrient assets to ${targetDir}`);
