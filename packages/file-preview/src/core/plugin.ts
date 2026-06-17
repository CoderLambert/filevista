import type { ComponentType } from "react";
import type { FileInfo } from "../utils";

export interface PreviewPlugin {
  id: string;
  name: string;
  priority?: number;
  match(file: FileInfo): boolean;
  load(): Promise<{ default: ComponentType<{ file: FileInfo }> }>;
}
