import type { PreviewSource } from "./types";
import { readSourceAsArrayBuffer } from "./source";

export async function downloadSource(
  source: PreviewSource,
  fileName: string,
  mimeType?: string
): Promise<void> {
  const buffer = await readSourceAsArrayBuffer(source);
  const blob = new Blob([buffer], {
    type: mimeType || "application/octet-stream",
  });

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
