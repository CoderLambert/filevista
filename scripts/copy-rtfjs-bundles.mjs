import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const bundles = [
  "rtf.js/dist/WMFJS.bundle.min.js",
  "rtf.js/dist/EMFJS.bundle.min.js",
  "rtf.js/dist/RTFJS.bundle.min.js",
];

const targetDir = path.resolve("public/vendor/rtfjs");
fs.mkdirSync(targetDir, { recursive: true });

for (const bundle of bundles) {
  const srcPath = require.resolve(bundle);
  const fileName = path.basename(bundle);
  const destPath = path.join(targetDir, fileName);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied ${fileName} to ${destPath}`);
}
