// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { processRemoteUrl, RemoteUrlError } from "../remote-url";

// Helper: build a Response whose body is a ReadableStream emitting `chunks`
// in order, with optional headers. We deliberately go through ReadableStream
// (not Response.arrayBuffer) so the streaming code path is exercised — that's
// where the in-flight maxBytes guard sits.
function streamedResponse(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("processRemoteUrl input validation", () => {
  it("rejects an empty URL with INVALID_URL", async () => {
    await expect(processRemoteUrl("")).rejects.toMatchObject({
      code: "INVALID_URL",
    });
  });

  it("rejects a malformed URL with INVALID_URL", async () => {
    await expect(processRemoteUrl("not a url")).rejects.toMatchObject({
      code: "INVALID_URL",
    });
  });

  it("rejects ftp:// (and other non-http) with UNSUPPORTED_PROTOCOL", async () => {
    await expect(
      processRemoteUrl("ftp://example.com/file.txt"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PROTOCOL" });
  });
});

describe("processRemoteUrl HTTP errors", () => {
  it("maps non-2xx responses to HTTP_ERROR", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(
      processRemoteUrl("https://example.com/missing.pdf"),
    ).rejects.toMatchObject({
      code: "REMOTE_HTTP_ERROR",
      remoteCode: "HTTP_ERROR",
    });
  });

  it("maps a fetch rejection (CORS/network) to NETWORK_OR_CORS", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch"); // browser CORS / network shape
    });
    await expect(
      processRemoteUrl("https://example.com/file.pdf"),
    ).rejects.toMatchObject({
      code: "REMOTE_CORS_ERROR",
      remoteCode: "NETWORK_OR_CORS",
    });
  });

  it("propagates AbortError as ABORTED, not NETWORK_OR_CORS", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(
      processRemoteUrl("https://example.com/file.pdf"),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});

describe("processRemoteUrl maxBytes enforcement", () => {
  // Build a tiny PDF magic header so the small-file happy paths still detect.
  const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

  it("rejects via Content-Length pre-flight when the header exceeds maxBytes", async () => {
    // Server promises 200 MB up front. We must reject before reading any bytes.
    globalThis.fetch = vi.fn(
      async () =>
        new Response("should-never-be-read", {
          status: 200,
          headers: { "content-length": String(200 * 1024 * 1024) },
        }),
    );

    await expect(
      processRemoteUrl("https://example.com/huge.pdf", {
        maxBytes: 100 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("aborts mid-stream when no Content-Length is set and bytes exceed maxBytes", async () => {
    // 5 chunks × 1 MB, no content-length. With maxBytes=2 MB, the third chunk
    // should trip the guard.
    const oneMB = new Uint8Array(1024 * 1024);
    globalThis.fetch = vi.fn(
      async () => streamedResponse([oneMB, oneMB, oneMB, oneMB, oneMB]),
    );

    await expect(
      processRemoteUrl("https://example.com/stream.bin", {
        maxBytes: 2 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("succeeds when total stays under maxBytes", async () => {
    const chunk = new Uint8Array(PDF_MAGIC.length + 100);
    chunk.set(PDF_MAGIC, 0);
    globalThis.fetch = vi.fn(
      async () =>
        streamedResponse([chunk], {
          "content-length": String(chunk.byteLength),
        }),
    );

    const info = await processRemoteUrl("https://example.com/small.pdf", {
      maxBytes: 1024 * 1024,
    });
    expect(info.size).toBe(chunk.byteLength);
    expect(info.fileType).toBe("pdf");
  });

  it("uses the 100 MB default cap when maxBytes is not provided", async () => {
    // Server claims 150 MB → must fail without an explicit maxBytes.
    globalThis.fetch = vi.fn(
      async () =>
        new Response("payload", {
          status: 200,
          headers: { "content-length": String(150 * 1024 * 1024) },
        }),
    );

    await expect(
      processRemoteUrl("https://example.com/huge.bin"),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("disables the cap when maxBytes is Infinity", async () => {
    const chunk = new Uint8Array(PDF_MAGIC.length + 100);
    chunk.set(PDF_MAGIC, 0);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(chunk, {
          status: 200,
          // Lie about size — way over the 100 MB default.
          headers: { "content-length": String(500 * 1024 * 1024) },
        }),
    );

    const info = await processRemoteUrl("https://example.com/lying.pdf", {
      maxBytes: Infinity,
    });
    expect(info).toBeTruthy();
  });
});

describe("processRemoteUrl error type", () => {
  it("throws RemoteUrlError instances (so consumers can `instanceof`-check)", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));

    let caught: unknown;
    try {
      await processRemoteUrl("https://example.com/x");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RemoteUrlError);
  });
});
