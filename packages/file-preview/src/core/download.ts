import type { PreviewSource } from "./types";
import { PreviewError } from "./preview-error";

function downloadBlobDirectly(
  blobLike: Blob | File,
  fileName: string,
): void {
  const url = URL.createObjectURL(blobLike);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadUrlDirectly(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}

async function downloadUrlWithHeaders(
  source: Extract<PreviewSource, { kind: "url" }>,
  fileName: string,
  mimeType?: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(source.url, { headers: source.headers });
  } catch (error) {
    // fetch rejects with a TypeError on network failure / CORS rejection —
    // normalize to REMOTE_CORS_ERROR so consumers can branch on the code.
    throw new PreviewError(
      "REMOTE_CORS_ERROR",
      `Failed to fetch ${source.url}: network error or blocked by CORS.`,
      {
        url: source.url,
        cause: error,
        details: {
          originalName: error instanceof Error ? error.name : String(error),
        },
      },
    );
  }

  if (!response.ok) {
    throw new PreviewError(
      "REMOTE_HTTP_ERROR",
      `Download failed: ${response.status} ${response.statusText}`,
      {
        url: source.url,
        details: { status: response.status, statusText: response.statusText },
      },
    );
  }

  const blob = await response.blob();
  // Caller-supplied mimeType wins over the response's Content-Type so a
  // misconfigured server (e.g. returning application/octet-stream) can't
  // strip the file of its intended type.
  const finalBlob = mimeType && blob.type !== mimeType
    ? new Blob([await blob.arrayBuffer()], { type: mimeType })
    : blob;

  downloadBlobDirectly(
    finalBlob,
    fileName || extractFileNameFromUrl(source.url),
  );
}

function extractFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split("/")
      .filter(Boolean);
    return segments[segments.length - 1] || "download";
  } catch {
    return "download";
  }
}

export async function downloadSource(
  source: PreviewSource,
  fileName: string,
  mimeType?: string,
): Promise<void> {
  switch (source.kind) {
    case "file":
      return downloadBlobDirectly(source.file, fileName);

    case "blob":
      return downloadBlobDirectly(source.blob, fileName);

    case "arrayBuffer":
      return downloadBlobDirectly(
        new Blob([source.buffer], {
          type:
            mimeType ||
            source.mimeType ||
            "application/octet-stream",
        }),
        fileName,
      );

    case "url":
      if (
        !source.headers ||
        !Object.keys(source.headers).length
      ) {
        return downloadUrlDirectly(source.url, fileName);
      }

      return downloadUrlWithHeaders(source, fileName, mimeType);
  }
}
