import { base64ToUint8Array } from "../utils";
import { readSourceAsArrayBuffer } from "./source";
import type { PreviewSource } from "./types";

export interface BinaryPreviewInput {
  source?: PreviewSource;
  content?: string | null;
}

export async function readBinaryPreviewAsArrayBuffer({
  source,
  content,
}: BinaryPreviewInput): Promise<ArrayBuffer> {
  if (source) {
    return readSourceAsArrayBuffer(source);
  }

  if (!content) {
    throw new Error("No binary preview source or legacy base64 content provided");
  }

  const bytes = base64ToUint8Array(content);

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

export async function readBinaryPreviewAsUint8Array(
  input: BinaryPreviewInput
): Promise<Uint8Array> {
  const buffer = await readBinaryPreviewAsArrayBuffer(input);
  return new Uint8Array(buffer);
}
