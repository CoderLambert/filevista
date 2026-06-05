declare module "rtf.js" {
  export interface DocumentOptions {
    images?: Record<string, string>;
    [key: string]: unknown;
  }

  export interface RenderOptions {
    css?: { [key: string]: string }[];
    styles?: { [key: string]: string }[];
  }

  export class Document {
    constructor(
      arrayBuffer: ArrayBuffer | Uint8Array,
      options?: DocumentOptions,
    );

    render(options?: RenderOptions): Promise<HTMLElement[]>;

    setConfig(config: Record<string, unknown>): void;
  }

  export default Document;
}
