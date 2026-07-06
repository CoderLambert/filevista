import { describe, it, expect } from "vitest";
import {
  getPreviewSizeLevel,
  getPreviewSizePolicy,
  resolvePreviewSizePolicy,
  validatePreviewSizePolicy,
  PREVIEW_SIZE_LIMITS,
} from "../performance-limits";

describe("PREVIEW_SIZE_LIMITS", () => {
  it("warning threshold is 20 MB", () => {
    expect(PREVIEW_SIZE_LIMITS.warning).toBe(20 * 1024 * 1024);
  });

  it("confirm threshold is 50 MB", () => {
    expect(PREVIEW_SIZE_LIMITS.confirm).toBe(50 * 1024 * 1024);
  });

  it("block threshold is 100 MB", () => {
    expect(PREVIEW_SIZE_LIMITS.block).toBe(100 * 1024 * 1024);
  });
});

describe("getPreviewSizeLevel", () => {
  it("0 bytes returns normal", () => {
    expect(getPreviewSizeLevel(0)).toBe("normal");
  });

  it("19.9 MB returns normal", () => {
    expect(getPreviewSizeLevel(19.9 * 1024 * 1024)).toBe("normal");
  });

  it("20 MB returns warning", () => {
    expect(getPreviewSizeLevel(20 * 1024 * 1024)).toBe("warning");
  });

  it("49.9 MB returns warning", () => {
    expect(getPreviewSizeLevel(49.9 * 1024 * 1024)).toBe("warning");
  });

  it("50 MB returns confirm", () => {
    expect(getPreviewSizeLevel(50 * 1024 * 1024)).toBe("confirm");
  });

  it("99.9 MB returns confirm", () => {
    expect(getPreviewSizeLevel(99.9 * 1024 * 1024)).toBe("confirm");
  });

  it("100 MB returns block", () => {
    expect(getPreviewSizeLevel(100 * 1024 * 1024)).toBe("block");
  });

  it("200 MB returns block", () => {
    expect(getPreviewSizeLevel(200 * 1024 * 1024)).toBe("block");
  });
});

describe("getPreviewSizePolicy", () => {
  it("normal file has no warn/confirm/block", () => {
    const policy = getPreviewSizePolicy({ size: 5 * 1024 * 1024 });
    expect(policy.level).toBe("normal");
    expect(policy.shouldWarn).toBe(false);
    expect(policy.shouldConfirm).toBe(false);
    expect(policy.shouldBlock).toBe(false);
    expect(policy.message).toBeNull();
    expect(policy.maxBytes).toBe(100 * 1024 * 1024);
    expect(policy.actualBytes).toBe(5 * 1024 * 1024);
  });

  it("warning file has warn but no confirm/block", () => {
    const policy = getPreviewSizePolicy({ size: 30 * 1024 * 1024 });
    expect(policy.level).toBe("warning");
    expect(policy.shouldWarn).toBe(true);
    expect(policy.shouldConfirm).toBe(false);
    expect(policy.shouldBlock).toBe(false);
    expect(policy.message).not.toBeNull();
  });

  it("confirm file has warn and confirm but no block", () => {
    const policy = getPreviewSizePolicy({ size: 75 * 1024 * 1024 });
    expect(policy.level).toBe("confirm");
    expect(policy.shouldWarn).toBe(true);
    expect(policy.shouldConfirm).toBe(true);
    expect(policy.shouldBlock).toBe(false);
    expect(policy.message).not.toBeNull();
  });

  it("block file has warn and block but no confirm", () => {
    const policy = getPreviewSizePolicy({ size: 150 * 1024 * 1024 });
    expect(policy.level).toBe("block");
    expect(policy.shouldWarn).toBe(true);
    expect(policy.shouldConfirm).toBe(false);
    expect(policy.shouldBlock).toBe(true);
    expect(policy.message).not.toBeNull();
    expect(policy.maxBytes).toBe(100 * 1024 * 1024);
    expect(policy.actualBytes).toBe(150 * 1024 * 1024);
  });

  it("policy='off' returns normal regardless of size", () => {
    const policy = getPreviewSizePolicy({
      size: 200 * 1024 * 1024,
      policy: "off",
    });
    expect(policy.level).toBe("normal");
    expect(policy.shouldWarn).toBe(false);
    expect(policy.shouldConfirm).toBe(false);
    expect(policy.shouldBlock).toBe(false);
    expect(policy.maxBytes).toBeNull();
  });

  it("custom maxBytes: file at maxBytes is not blocked", () => {
    const MB = 1024 * 1024;
    const policy = getPreviewSizePolicy({
      size: 50 * MB,
      policy: { maxBytes: 50 * MB },
    });
    expect(policy.shouldBlock).toBe(false);
    expect(policy.maxBytes).toBe(50 * MB);
  });

  it("custom maxBytes: file exceeding maxBytes is blocked", () => {
    const MB = 1024 * 1024;
    const policy = getPreviewSizePolicy({
      size: 50.1 * MB,
      policy: { maxBytes: 50 * MB },
    });
    expect(policy.level).toBe("block");
    expect(policy.shouldBlock).toBe(true);
    expect(policy.maxBytes).toBe(50 * MB);
    expect(policy.actualBytes).toBe(50.1 * MB);
  });

  it("custom warningBytes solo", () => {
    const MB = 1024 * 1024;
    const policy = getPreviewSizePolicy({
      size: 15 * MB,
      policy: { maxBytes: 50 * MB, warningBytes: 10 * MB },
    });
    expect(policy.level).toBe("warning");
    expect(policy.shouldWarn).toBe(true);
  });

  it("custom confirmBytes solo", () => {
    const MB = 1024 * 1024;
    const policy = getPreviewSizePolicy({
      size: 30 * MB,
      policy: { maxBytes: 50 * MB, confirmBytes: 25 * MB },
    });
    expect(policy.level).toBe("confirm");
    expect(policy.shouldConfirm).toBe(true);
  });

  it("null warningBytes disables warning", () => {
    const MB = 1024 * 1024;
    const policy = getPreviewSizePolicy({
      size: 40 * MB,
      policy: { maxBytes: 50 * MB, warningBytes: null, confirmBytes: 30 * MB },
    });
    // 40 MB >= 30 MB (confirm) → confirm, no warning level because warning is disabled
    expect(policy.level).toBe("confirm");
  });
});

describe("resolvePreviewSizePolicy", () => {
  it("default returns PREVIEW_SIZE_LIMITS values", () => {
    const resolved = resolvePreviewSizePolicy("default");
    expect(resolved.enabled).toBe(true);
    expect(resolved.warningBytes).toBe(PREVIEW_SIZE_LIMITS.warning);
    expect(resolved.confirmBytes).toBe(PREVIEW_SIZE_LIMITS.confirm);
    expect(resolved.maxBytes).toBe(PREVIEW_SIZE_LIMITS.block);
  });

  it("off returns disabled", () => {
    const resolved = resolvePreviewSizePolicy("off");
    expect(resolved.enabled).toBe(false);
    expect(resolved.warningBytes).toBeNull();
    expect(resolved.confirmBytes).toBeNull();
    expect(resolved.maxBytes).toBeNull();
  });

  it("custom config is reflected", () => {
    const MB = 1024 * 1024;
    const resolved = resolvePreviewSizePolicy({ maxBytes: 50 * MB });
    expect(resolved.enabled).toBe(true);
    expect(resolved.maxBytes).toBe(50 * MB);
    expect(resolved.warningBytes).toBeNull();
    expect(resolved.confirmBytes).toBeNull();
  });

  it("custom config with all thresholds", () => {
    const MB = 1024 * 1024;
    const resolved = resolvePreviewSizePolicy({
      maxBytes: 100 * MB,
      warningBytes: 20 * MB,
      confirmBytes: 50 * MB,
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.warningBytes).toBe(20 * MB);
    expect(resolved.confirmBytes).toBe(50 * MB);
    expect(resolved.maxBytes).toBe(100 * MB);
  });
});

describe("validatePreviewSizePolicy", () => {
  it("throws on zero maxBytes", () => {
    expect(() => validatePreviewSizePolicy({ maxBytes: 0 })).toThrow(TypeError);
  });

  it("throws on negative maxBytes", () => {
    expect(() => validatePreviewSizePolicy({ maxBytes: -1 })).toThrow(TypeError);
  });

  it("throws on non-finite maxBytes", () => {
    expect(() => validatePreviewSizePolicy({ maxBytes: Infinity })).toThrow(TypeError);
    expect(() => validatePreviewSizePolicy({ maxBytes: NaN })).toThrow(TypeError);
  });

  it("throws on zero warningBytes", () => {
    expect(() =>
      validatePreviewSizePolicy({ maxBytes: 100, warningBytes: 0 }),
    ).toThrow(TypeError);
  });

  it("throws on warningBytes >= confirmBytes", () => {
    expect(() =>
      validatePreviewSizePolicy({
        maxBytes: 100,
        warningBytes: 50,
        confirmBytes: 50,
      }),
    ).toThrow(TypeError);
  });

  it("throws on warningBytes >= maxBytes", () => {
    const MB = 1024 * 1024;
    expect(() =>
      validatePreviewSizePolicy({
        maxBytes: 50 * MB,
        warningBytes: 50 * MB,
      }),
    ).toThrow(TypeError);
  });

  it("throws on confirmBytes >= maxBytes", () => {
    const MB = 1024 * 1024;
    expect(() =>
      validatePreviewSizePolicy({
        maxBytes: 50 * MB,
        confirmBytes: 50 * MB,
      }),
    ).toThrow(TypeError);
  });
});
