// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createObjectUrlFromSource,
  getSourceMimeType,
  getSourceName,
  getSourceSize,
  readSourceAsArrayBuffer,
  readSourceAsBase64,
  readSourceAsText,
} from "../core/source";
import type { PreviewSource } from "../core/types";

// ─── helpers ──────────────────────────────────────────────────────────────

function file(name: string, body = "hello", type = "text/plain"): PreviewSource {
  return { kind: "file", file: new File([body], name, { type }) };
}

function blob(body = "blob-body", type = "text/plain"): PreviewSource {
  return { kind: "blob", blob: new Blob([body], { type }) };
}

function buffer(body = "buf"): PreviewSource {
  return { kind: "arrayBuffer", buffer: new TextEncoder().encode(body).buffer as ArrayBuffer };
}

function url(url = "https://example.com/x.txt"): PreviewSource {
  return { kind: "url", url };
}

// ─── readSourceAsArrayBuffer ──────────────────────────────────────────────

describe("readSourceAsArrayBuffer", () => {
  it("reads a File", async () => {
    const buf = await readSourceAsArrayBuffer(file("a.txt", "hi"));
    expect(new TextDecoder().decode(buf)).toBe("hi");
  });

  it("reads a Blob", async () => {
    const buf = await readSourceAsArrayBuffer(blob("ho"));
    expect(new TextDecoder().decode(buf)).toBe("ho");
  });

  it("returns a copy, not the underlying ArrayBuffer reference", async () => {
    const original = new TextEncoder().encode("abc").buffer as ArrayBuffer;
    const buf = await readSourceAsArrayBuffer({
      kind: "arrayBuffer",
      buffer: original,
    });
    expect(buf).not.toBe(original); // distinct reference — defensive copy
    expect(new TextDecoder().decode(buf)).toBe("abc");
    // The original is still usable (not detached) after the read.
    expect(original.byteLength).toBe(3);
  });

  it("keeps the source buffer usable after the returned copy is detached", async () => {
    // Reproduces the PdfPreview crash: pdf.js's `getDocument({ data })`
    // transfers the underlying ArrayBuffer to a Web Worker, detaching it.
    // Before the fix, readSourceAsArrayBuffer returned `source.buffer`
    // directly, so after the first read the source buffer was detached and
    // a second read (React StrictMode double-invoke, file re-selection,
    // source reuse) crashed with "Cannot perform Construct on a detached
    // ArrayBuffer". The fix returns a copy, so only the copy gets detached.
    const source = buffer("payload");
    const original = (source as { buffer: ArrayBuffer }).buffer;

    const first = await readSourceAsArrayBuffer(source);
    expect(new TextDecoder().decode(first)).toBe("payload");

    // Detach the *returned* buffer (mimics worker transfer of `data`).
    const port = new MessageChannel();
    port.port1.postMessage(first, [first]);
    port.port1.close();
    port.port2.close();
    expect(first.byteLength).toBe(0); // returned copy is detached

    // The source's own buffer must still be intact — second read works.
    expect(original.byteLength).toBe("payload".length);
    const second = await readSourceAsArrayBuffer(source);
    expect(new TextDecoder().decode(second)).toBe("payload");
    expect(second).not.toBe(first); // a fresh copy each call
  });

  describe("url", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("fetches and returns the body", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(new TextEncoder().encode("network"), { status: 200 }),
      );
      const buf = await readSourceAsArrayBuffer(url());
      expect(new TextDecoder().decode(buf)).toBe("network");
    });

    it("throws with the status code on non-2xx", async () => {
      globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
      await expect(readSourceAsArrayBuffer(url())).rejects.toThrow(
        /Failed to fetch file: 404/,
      );
    });

    it("forwards custom headers and the abort signal", async () => {
      const spy = vi.fn(async () =>
        new Response(new TextEncoder().encode("ok"), { status: 200 }),
      );
      globalThis.fetch = spy;
      const controller = new AbortController();
      await readSourceAsArrayBuffer(
        { kind: "url", url: "https://example.com/x", headers: { "X-Custom": "1" } },
        { signal: controller.signal },
      );
      expect(spy).toHaveBeenCalledWith(
        "https://example.com/x",
        expect.objectContaining({
          headers: { "X-Custom": "1" },
          signal: controller.signal,
        }),
      );
    });
  });

  it.each(["file", "blob", "arrayBuffer"] as const)(
    "throws AbortError synchronously for %s source when signal is pre-aborted",
    async (kind) => {
      const source =
        kind === "file" ? file("a") : kind === "blob" ? blob() : buffer();
      const controller = new AbortController();
      controller.abort();
      await expect(
        readSourceAsArrayBuffer(source, { signal: controller.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });
    },
  );

  it("rejects an unknown source kind", async () => {
    await expect(
      // @ts-expect-error — intentional bad input
      readSourceAsArrayBuffer({ kind: "nope" }),
    ).rejects.toThrow(/Unsupported preview source/);
  });
});

// ─── readSourceAsText ─────────────────────────────────────────────────────

describe("readSourceAsText", () => {
  it("reads a File as text", async () => {
    expect(await readSourceAsText(file("a.txt", "hi"))).toBe("hi");
  });

  it("reads a Blob as text", async () => {
    expect(await readSourceAsText(blob("blobtext"))).toBe("blobtext");
  });

  it("decodes an ArrayBuffer as UTF-8", async () => {
    expect(await readSourceAsText(buffer("héllo"))).toBe("héllo");
  });

  it("fetches a URL as text", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("from-net", { status: 200 }));
    try {
      expect(await readSourceAsText(url())).toBe("from-net");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects on non-2xx URL response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));
    try {
      await expect(readSourceAsText(url())).rejects.toThrow(/Failed to fetch text: 500/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── readSourceAsBase64 ───────────────────────────────────────────────────

describe("readSourceAsBase64", () => {
  it("encodes bytes as base64", async () => {
    expect(await readSourceAsBase64(buffer("hi"))).toBe(btoa("hi"));
  });

  it("handles inputs longer than the 8KB chunk window", async () => {
    // 10000 bytes — crosses the 8192-byte chunk boundary in readSourceAsBase64.
    const payload = "x".repeat(10_000);
    const expected = btoa(payload);
    expect(await readSourceAsBase64(buffer(payload))).toBe(expected);
  });
});

// ─── createObjectUrlFromSource ────────────────────────────────────────────

describe("createObjectUrlFromSource", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
  });

  it("creates a URL for a File source", () => {
    expect(createObjectUrlFromSource(file("a"))).toBe("blob:mock-url");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("creates a URL for a Blob source", () => {
    expect(createObjectUrlFromSource(blob())).toBe("blob:mock-url");
  });

  it("returns null for non-blob sources", () => {
    expect(createObjectUrlFromSource(buffer())).toBeNull();
    expect(createObjectUrlFromSource(url())).toBeNull();
  });
});

// ─── metadata accessors ──────────────────────────────────────────────────

describe("getSourceName", () => {
  it("returns File.name for file sources", () => {
    expect(getSourceName(file("doc.pdf"))).toBe("doc.pdf");
  });

  it("returns the optional name for blob/arrayBuffer sources", () => {
    expect(
      getSourceName({ kind: "blob", blob: new Blob(["x"]), name: "named.txt" }),
    ).toBe("named.txt");
    expect(getSourceName(blob())).toBeUndefined();
  });

  it("falls back to the URL basename when name is missing", () => {
    expect(getSourceName({ kind: "url", url: "https://x.com/a/b/file.pdf" })).toBe(
      "file.pdf",
    );
  });

  it("prefers the explicit name over the URL basename", () => {
    expect(
      getSourceName({ kind: "url", url: "https://x.com/a.pdf", name: "B.pdf" }),
    ).toBe("B.pdf");
  });
});

describe("getSourceMimeType", () => {
  it("returns File.type", () => {
    expect(getSourceMimeType(file("a", "x", "image/png"))).toBe("image/png");
  });

  it("prefers blob.mimeType over Blob.type", () => {
    expect(
      getSourceMimeType({
        kind: "blob",
        blob: new Blob([""], { type: "text/plain" }),
        mimeType: "application/json",
      }),
    ).toBe("application/json");
  });

  it("falls through to Blob.type when mimeType is not set", () => {
    expect(getSourceMimeType(blob("x", "image/gif"))).toBe("image/gif");
  });

  it("returns the optional mimeType for arrayBuffer and url", () => {
    expect(getSourceMimeType({ kind: "url", url: "x", mimeType: "video/mp4" })).toBe(
      "video/mp4",
    );
    expect(getSourceMimeType(url())).toBeUndefined();
  });
});

describe("getSourceSize", () => {
  it("returns File.size and Blob.size", () => {
    expect(getSourceSize(file("a", "hi"))).toBe(2);
    expect(getSourceSize(blob("xyzab"))).toBe(5);
  });

  it("returns ArrayBuffer.byteLength", () => {
    expect(getSourceSize(buffer("hello"))).toBe(5);
  });

  it("returns undefined for URL sources (size unknown until fetched)", () => {
    expect(getSourceSize(url())).toBeUndefined();
  });
});
