/**
 * Copy PDF.js worker into public/vendor/pdfjs/.
 *
 * `pdfjs-dist` is an *optional* peer dependency of @lamberl-lee/file-preview.
 * If it's not installed (e.g. the consumer doesn't preview PDF files), this
 * script is a no-op so the postinstall hook stays safe to run unconditionally.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let workerPath;
try {
  workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
} catch {
  console.log(
    "[@lamberl-lee/file-preview] pdfjs-dist not installed — skipping PDF.js worker copy. " +
      "Add pdfjs-dist to your dependencies to enable PDF preview.",
  );
  process.exit(0);
}

const targetDir = path.resolve("public/vendor/pdfjs");
const targetPath = path.join(targetDir, "pdf.worker.min.mjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(workerPath, targetPath);

console.log(`Copied PDF.js worker to ${targetPath}`);
