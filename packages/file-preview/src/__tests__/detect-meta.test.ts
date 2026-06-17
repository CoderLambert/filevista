// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { sniffMagic, sniffZipContainer } from "../core/magic-bytes";
import { detectFileMeta } from "../core/detect-meta";

function bytes(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer as ArrayBuffer;
}

function bufferSource(buffer: ArrayBuffer, name: string, mimeType = "") {
  return { kind: "arrayBuffer" as const, buffer, name, mimeType };
}

async function zipWith(entries: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("sniffMagic", () => {
  it("detects PDF even when filename would suggest something else", () => {
    expect(sniffMagic(bytes([0x25, 0x50, 0x44, 0x46, 0x2d]))).toMatchObject({
      ext: "pdf",
      mimeType: "application/pdf",
    });
  });

  it.each([
    ["png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
    ["jpg", [0xff, 0xd8, 0xff], "image/jpeg"],
    ["gif", [..."GIF89a"].map((c) => c.charCodeAt(0)), "image/gif"],
  ])("detects %s signatures", (_ext, signature, mimeType) => {
    expect(sniffMagic(bytes(signature))).toMatchObject({ mimeType });
  });

  it("detects WebP via RIFF/WEBP", () => {
    const header = new Uint8Array(12);
    header.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    header.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
    expect(sniffMagic(header.buffer as ArrayBuffer)).toMatchObject({
      ext: "webp",
      mimeType: "image/webp",
    });
  });

  it("detects OLE compound documents for legacy Office", () => {
    expect(
      sniffMagic(bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    ).toMatchObject({ ext: "ole" });
  });
});

describe("sniffZipContainer", () => {
  it("distinguishes DOCX / PPTX / XLSX / EPUB from a generic zip", async () => {
    await expect(sniffZipContainer(await zipWith({ "word/document.xml": "" }))).resolves.toMatchObject({ ext: "docx" });
    await expect(sniffZipContainer(await zipWith({ "ppt/presentation.xml": "" }))).resolves.toMatchObject({ ext: "pptx" });
    await expect(sniffZipContainer(await zipWith({ "xl/workbook.xml": "" }))).resolves.toMatchObject({ ext: "xlsx" });
    await expect(sniffZipContainer(await zipWith({ mimetype: "application/epub+zip" }))).resolves.toMatchObject({ ext: "epub" });
    await expect(sniffZipContainer(await zipWith({ "plain.txt": "x" }))).resolves.toBeNull();
  });
});

describe("detectFileMeta", () => {
  it("trusts PDF magic over a misleading filename and MIME", async () => {
    const meta = await detectFileMeta(
      bufferSource(bytes([0x25, 0x50, 0x44, 0x46, 0x2d]), "not-a-pdf.txt", "text/plain"),
    );
    expect(meta).toMatchObject({
      fileType: "pdf",
      mimeType: "application/pdf",
      confidence: "high",
      detectBy: "magic",
    });
  });

  it("detects ZIP container formats even when extension and MIME are empty", async () => {
    const meta = await detectFileMeta(bufferSource(await zipWith({ "word/document.xml": "" }), "upload.bin"));
    expect(meta).toMatchObject({
      fileType: "docx",
      confidence: "high",
      detectBy: "container",
    });
  });

  it("uses OLE magic + extension to identify legacy Office", async () => {
    const meta = await detectFileMeta(
      bufferSource(bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "legacy.xls"),
    );
    expect(meta).toMatchObject({
      fileType: "xls",
      mimeType: "application/x-ole-storage",
      confidence: "high",
      detectBy: "magic",
    });
  });

  it("falls back to extension with medium confidence for text-like files", async () => {
    const meta = await detectFileMeta(bufferSource(bytes([0x68, 0x69]), "README.md", ""));
    expect(meta).toMatchObject({
      fileType: "markdown",
      confidence: "medium",
      detectBy: "extension",
    });
  });

  it("falls back to MIME when extension is unknown", async () => {
    const meta = await detectFileMeta(bufferSource(bytes([0x68, 0x69]), "upload.bin", "text/csv"));
    expect(meta).toMatchObject({
      fileType: "csv",
      confidence: "medium",
      detectBy: "mime",
    });
  });
});
