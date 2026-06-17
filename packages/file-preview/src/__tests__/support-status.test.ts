import { describe, expect, it } from "vitest";
import { ALL_FILE_TYPES } from "../utils";
import {
  getPreviewSupportMeta,
  isDegradedFileType,
  isPluginSupportedFileType,
  isUnsupportedFileType,
  PREVIEW_SUPPORT_MATRIX,
} from "../support-status";

describe("preview support status matrix", () => {
  it("keeps ALL_FILE_TYPES unique", () => {
    expect(new Set(ALL_FILE_TYPES).size).toBe(ALL_FILE_TYPES.length);
  });

  it("covers every FileType", () => {
    expect(Object.keys(PREVIEW_SUPPORT_MATRIX).sort()).toEqual(
      [...ALL_FILE_TYPES].sort()
    );
  });

  it("keeps all plugin-supported file types associated with a plugin id", () => {
    for (const meta of Object.values(PREVIEW_SUPPORT_MATRIX)) {
      if (meta.status === "plugin-supported") {
        expect(meta.pluginId, `${meta.fileType} should define pluginId`).toBeTruthy();
        expect(meta.pluginRenderer).toBe("supported");
      }
    }
  });

  it("keeps degraded and unsupported file types without plugin id", () => {
    for (const meta of Object.values(PREVIEW_SUPPORT_MATRIX)) {
      if (meta.status === "degraded" || meta.status === "unsupported") {
        expect(meta.pluginId, `${meta.fileType} should not define pluginId`).toBeNull();
        expect(meta.pluginRenderer).toBe("unsupported");
      }
    }
  });

  it("classifies legacy office formats correctly", () => {
    expect(isDegradedFileType("doc")).toBe(true);
    expect(isUnsupportedFileType("ppt")).toBe(true);
    expect(isUnsupportedFileType("xls")).toBe(true);

    expect(isPluginSupportedFileType("docx")).toBe(true);
    expect(isPluginSupportedFileType("pptx")).toBe(true);
    expect(isPluginSupportedFileType("xlsx")).toBe(true);
  });

  it("returns support metadata by file type", () => {
    expect(getPreviewSupportMeta("pdf").pluginId).toBe("builtin.pdf");
    expect(getPreviewSupportMeta("json").pluginId).toBe("builtin.source-code");
    expect(getPreviewSupportMeta("unknown").status).toBe("unsupported");
  });
});
