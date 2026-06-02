import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const targetDir = path.resolve("public/vendor/pdfjs");
const targetPath = path.join(targetDir, "pdf.worker.min.mjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(workerPath, targetPath);

console.log(`Copied PDF.js worker to ${targetPath}`);
