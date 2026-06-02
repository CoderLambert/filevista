import type { PreviewSource } from "./types";

export async function readSourceAsArrayBuffer(
  source: PreviewSource
): Promise<ArrayBuffer> {
  switch (source.kind) {
    case "file":
      return source.file.arrayBuffer();

    case "blob":
      return source.blob.arrayBuffer();

    case "arrayBuffer":
      return source.buffer;

    case "url": {
      const response = await fetch(source.url, {
        headers: source.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      return response.arrayBuffer();
    }

    default:
      throw new Error("Unsupported preview source");
  }
}

export async function readSourceAsText(
  source: PreviewSource
): Promise<string> {
  switch (source.kind) {
    case "file":
      return source.file.text();

    case "blob":
      return source.blob.text();

    case "arrayBuffer":
      return new TextDecoder("utf-8").decode(source.buffer);

    case "url": {
      const response = await fetch(source.url, {
        headers: source.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch text: ${response.status}`);
      }

      return response.text();
    }

    default:
      throw new Error("Unsupported preview source");
  }
}

export async function readSourceAsBase64(
  source: PreviewSource
): Promise<string> {
  const buffer = await readSourceAsArrayBuffer(source);
  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function createObjectUrlFromSource(source: PreviewSource): string | null {
  if (source.kind === "file") {
    return URL.createObjectURL(source.file);
  }

  if (source.kind === "blob") {
    return URL.createObjectURL(source.blob);
  }

  return null;
}

export function getSourceName(source: PreviewSource): string | undefined {
  switch (source.kind) {
    case "file":
      return source.file.name;

    case "blob":
    case "arrayBuffer":
      return source.name;

    case "url":
      return source.name || source.url.split("/").pop();

    default:
      return undefined;
  }
}

export function getSourceMimeType(source: PreviewSource): string | undefined {
  switch (source.kind) {
    case "file":
      return source.file.type;

    case "blob":
      return source.mimeType || source.blob.type;

    case "arrayBuffer":
    case "url":
      return source.mimeType;

    default:
      return undefined;
  }
}

export function getSourceSize(source: PreviewSource): number | undefined {
  switch (source.kind) {
    case "file":
      return source.file.size;

    case "blob":
      return source.blob.size;

    case "arrayBuffer":
      return source.buffer.byteLength;

    case "url":
      return undefined;

    default:
      return undefined;
  }
}
