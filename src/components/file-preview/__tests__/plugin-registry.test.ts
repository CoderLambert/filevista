import { describe, expect, it } from "vitest";
import type { FileInfo, FileType } from "../utils";
import { createBuiltinPreviewRegistry } from "../plugins/builtin-plugins";
import { PREVIEW_SUPPORT_MATRIX } from "../support-status";

function createMockFile(fileType: FileType): FileInfo {
  return {
    id: `mock-${fileType}`,
    name: `mock.${fileType}`,
    size: 1,
    type: "",
    fileType,
    content: "mock",
    url: "blob:mock",
    source: undefined,
  };
}

describe("builtin plugin registry", () => {
  it("matches every plugin-supported file type to the expected plugin id", () => {
    const registry = createBuiltinPreviewRegistry();

    for (const meta of Object.values(PREVIEW_SUPPORT_MATRIX)) {
      if (meta.status !== "plugin-supported") continue;

      const plugin = registry.resolve(createMockFile(meta.fileType));

      expect(plugin?.id, `${meta.fileType} should match ${meta.pluginId}`).toBe(
        meta.pluginId
      );
    }
  });

  it("does not match degraded or unsupported file types", () => {
    const registry = createBuiltinPreviewRegistry();

    for (const meta of Object.values(PREVIEW_SUPPORT_MATRIX)) {
      if (meta.status === "plugin-supported") continue;

      const plugin = registry.resolve(createMockFile(meta.fileType));

      expect(plugin, `${meta.fileType} should not match any plugin`).toBeNull();
    }
  });

  it("keeps json routed to the source-code plugin intentionally", () => {
    const registry = createBuiltinPreviewRegistry();

    const plugin = registry.resolve(createMockFile("json"));

    expect(plugin?.id).toBe("builtin.source-code");
  });

  it("keeps legacy office formats out of modern office plugins", () => {
    const registry = createBuiltinPreviewRegistry();

    expect(registry.resolve(createMockFile("doc"))).toBeNull();
    expect(registry.resolve(createMockFile("ppt"))).toBeNull();
    expect(registry.resolve(createMockFile("xls"))).toBeNull();
  });
});
