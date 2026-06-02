"use client";

import { ShikiSourceView } from "./ShikiSourceView";

interface TextPreviewProps {
  content: string;
  fileName: string;
}

export function TextPreview({ content, fileName }: TextPreviewProps) {
  return <ShikiSourceView content={content} fileName={fileName} />;
}
