import { defineConfig } from "tsup";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Recursively copy non-source side-effect files (CSS) from src/ to dist/
 * so consumer bundlers can resolve `import "./styles/Foo.css"` exactly the
 * way it appears in the source.
 */
async function copyNonSourceAssets(srcDir: string, destDir: string) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "__tests__") continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyNonSourceAssets(srcPath, destPath);
    } else if (entry.name.endsWith(".css")) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export default defineConfig({
  entry: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
    "!src/**/__tests__/**",
    "!src/**/*.d.ts",
  ],
  format: ["esm"],
  dts: true,
  bundle: false, // preserve module structure — better for code-splitting and CSS side-imports
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2020",
  external: ["react", "react-dom"],
  async onSuccess() {
    await copyNonSourceAssets("src", "dist");
  },
});
