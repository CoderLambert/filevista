import { defineConfig } from "vitest/config";

export default defineConfig({
  // No path alias needed — tests use relative imports.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node", // individual tests opt in to jsdom via `// @vitest-environment jsdom`
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
    ],
    exclude: ["node_modules", "dist"],
  },
});
