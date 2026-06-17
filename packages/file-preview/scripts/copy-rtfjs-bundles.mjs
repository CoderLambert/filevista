/**
 * Copy rtf.js bundle files to public/vendor/rtfjs/.
 *
 * The npm module's `import 'rtf.js'` does not interop cleanly with
 * Next.js / Turbopack. The bundles are loaded at runtime via static
 * <script> tags from public/, see src/rtf/load-rtfjs.ts.
 *
 * Run from `postinstall` so the bundles are present before the dev
 * server or production build can request them.
 *
 * `rtf.js` is an *optional* peer dependency of @filevista/file-preview.
 * If it's not installed (consumer doesn't preview RTF files), this
 * script is a no-op so the postinstall hook stays safe to run
 * unconditionally.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const bundles = [
  "rtf.js/dist/WMFJS.bundle.min.js",
  "rtf.js/dist/EMFJS.bundle.min.js",
  "rtf.js/dist/RTFJS.bundle.min.js",
];

// Probe a single entry to detect whether the package is installed at all,
// so we fail with one friendly message instead of a require.resolve stack.
try {
  require.resolve(bundles[0]);
} catch {
  console.log(
    "[@filevista/file-preview] rtf.js not installed — skipping RTF.js bundles copy. " +
      "Add rtf.js to your dependencies to enable RTF preview.",
  );
  process.exit(0);
}

const targetDir = path.resolve("public/vendor/rtfjs");
fs.mkdirSync(targetDir, { recursive: true });

for (const bundle of bundles) {
  const srcPath = require.resolve(bundle);
  const fileName = path.basename(bundle);
  const destPath = path.join(targetDir, fileName);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied ${fileName} to ${destPath}`);
}
