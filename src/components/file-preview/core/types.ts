import type { FileType } from "../utils";

export type PreviewSource =
  | {
      kind: "file";
      file: File;
    }
  | {
      kind: "blob";
      blob: Blob;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "arrayBuffer";
      buffer: ArrayBuffer;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "url";
      url: string;
      name?: string;
      mimeType?: string;
      headers?: Record<string, string>;
    };

export interface NormalizedFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  extension?: string;
  fileType: FileType;
  source: PreviewSource;
}
