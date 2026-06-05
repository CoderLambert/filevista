import { describe, it, expect } from "vitest";
import {
  getPreviewSizeLevel,
  getPreviewSizePolicy,
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
  });
});
