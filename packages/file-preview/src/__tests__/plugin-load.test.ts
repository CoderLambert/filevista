import { describe, expect, it } from "vitest";
import {
  loadWithOptionalDep,
  MissingPeerDependencyError,
} from "../core/plugin";

// ─── happy path ───────────────────────────────────────────────────────────

describe("loadWithOptionalDep — happy path", () => {
  it("passes the loader result through when the import succeeds", async () => {
    const loaded = { default: () => null };
    const load = loadWithOptionalDep(async () => loaded, {
      package: "fake-pkg",
      featureLabel: "Fake feature",
    });

    expect(await load()).toBe(loaded);
  });
});

// ─── error rewrapping ─────────────────────────────────────────────────────

describe("loadWithOptionalDep — error handling", () => {
  // The detector recognizes 5 distinct messages from Webpack / Turbopack /
  // native ESM / Vite / Metro. We exercise each so a stylistic change in
  // one of them is caught here, not silently in production.
  const moduleMissingMessages = {
    "Webpack / Node ESM 'Cannot find module'":
      `Cannot find module 'pdfjs-dist'`,
    "Native browser ESM 'Failed to fetch dynamically imported module'":
      `Failed to fetch dynamically imported module: /node_modules/pdfjs-dist/index.js`,
    "Vite dev 'Failed to resolve module specifier'":
      `Failed to resolve module specifier "pdfjs-dist"`,
    "Webpack production 'Module not found'":
      `Module not found: Error: Can't resolve 'pdfjs-dist'`,
    "Metro 'Unable to resolve'":
      `Unable to resolve module pdfjs-dist from ...`,
  };

  it.each(Object.entries(moduleMissingMessages))(
    "rewraps %s as MissingPeerDependencyError",
    async (_label, message) => {
      const load = loadWithOptionalDep(
        async () => {
          throw new Error(message);
        },
        { package: "pdfjs-dist", featureLabel: "PDF preview" },
      );

      await expect(load()).rejects.toBeInstanceOf(MissingPeerDependencyError);
      await expect(load()).rejects.toMatchObject({
        packageName: "pdfjs-dist",
        featureLabel: "PDF preview",
      });
    },
  );

  it("keeps the original error as the cause for debugging", async () => {
    const original = new Error("Cannot find module 'rtf.js'");
    const load = loadWithOptionalDep(
      async () => {
        throw original;
      },
      { package: "rtf.js", featureLabel: "RTF preview" },
    );

    await expect(load()).rejects.toMatchObject({ cause: original });
  });

  it("includes an install hint mentioning the package in the message", async () => {
    const load = loadWithOptionalDep(
      async () => {
        throw new Error("Cannot find module 'exceljs'");
      },
      { package: "exceljs", featureLabel: "XLSX preview" },
    );

    await expect(load()).rejects.toThrow(
      /XLSX preview requires the optional peer dependency "exceljs"/,
    );
    await expect(load()).rejects.toThrow(/pnpm add exceljs/);
  });

  // The detector intentionally requires the package name to appear in the
  // message — otherwise we'd attribute a totally unrelated error to the
  // wrong dependency.
  it("passes through 'module not found' errors that name a different package", async () => {
    const original = new Error("Cannot find module 'some-other-lib'");
    const load = loadWithOptionalDep(
      async () => {
        throw original;
      },
      { package: "pdfjs-dist", featureLabel: "PDF preview" },
    );

    await expect(load()).rejects.toBe(original);
  });

  it("passes through unrelated runtime errors verbatim", async () => {
    const original = new TypeError("Cannot read property 'x' of undefined");
    const load = loadWithOptionalDep(
      async () => {
        throw original;
      },
      { package: "pdfjs-dist", featureLabel: "PDF preview" },
    );

    await expect(load()).rejects.toBe(original);
  });

  it("does not touch non-Error rejections", async () => {
    // Some bundlers (and bad code) throw strings or objects. The wrapper
    // should treat those as 'unrecognized' and not paper over them.
    const load = loadWithOptionalDep(
      async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "boom";
      },
      { package: "pdfjs-dist", featureLabel: "PDF preview" },
    );

    await expect(load()).rejects.toBe("boom");
  });
});
