"use client";

import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

interface EpubPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

interface EpubChapter {
  index: number;
  title: string;
  htmlContent: string;
}

async function parseEpub(base64Content: string): Promise<{
  title: string;
  author: string;
  chapters: EpubChapter[];
}> {
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes.buffer);
  const chapters: EpubChapter[] = [];
  let bookTitle = "";
  let bookAuthor = "";

  // Try to read metadata from container.xml → content.opf
  const containerFile = zip.file("META-INF/container.xml");
  if (containerFile) {
    const containerXml = await containerFile.async("string");
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (rootfileMatch) {
      const opfPath = rootfileMatch[1];
      const opfFile = zip.file(opfPath);
      if (opfFile) {
        const opfXml = await opfFile.async("string");

        // Extract title
        const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
        if (titleMatch) bookTitle = titleMatch[1];

        // Extract author
        const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
        if (authorMatch) bookAuthor = authorMatch[1];

        // Find spine order
        const spineMatch = opfXml.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
        const spineItems: string[] = [];
        if (spineMatch) {
          const itemrefRegex = /<itemref\s+idref="([^"]+)"/g;
          let refMatch;
          while ((refMatch = itemrefRegex.exec(spineMatch[1])) !== null) {
            spineItems.push(refMatch[1]);
          }
        }

        // Build manifest map: id -> href
        const manifestMatch = opfXml.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/);
        const manifestMap: Record<string, string> = {};
        if (manifestMatch) {
          const itemRegex = /<item\s+id="([^"]+)"[^>]*href="([^"]+)"/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(manifestMatch[1])) !== null) {
            manifestMap[itemMatch[1]] = itemMatch[2];
          }
        }

        // Get base path for resolving relative hrefs
        const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

        // Read chapters in spine order
        for (let i = 0; i < spineItems.length; i++) {
          const idref = spineItems[i];
          const href = manifestMap[idref];
          if (!href) continue;

          const filePath = opfDir + href;
          const chapterFile = zip.file(filePath);
          if (!chapterFile) continue;

          const chapterXml = await chapterFile.async("string");

          // Extract title from h1/h2/h3 or title tag
          let chapterTitle = `Chapter ${i + 1}`;
          const hMatch = chapterXml.match(/<h[1-3][^>]*>([^<]*)<\/h[1-3]>/);
          if (hMatch && hMatch[1].trim()) {
            chapterTitle = hMatch[1].trim();
          } else {
            const titleTagMatch = chapterXml.match(/<title>([^<]*)<\/title>/);
            if (titleTagMatch && titleTagMatch[1].trim()) {
              chapterTitle = titleTagMatch[1].trim();
            }
          }

          // Extract body content
          const bodyMatch = chapterXml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
          const bodyHtml = bodyMatch ? bodyMatch[1] : chapterXml;

          // Clean up HTML - remove scripts, styles
          const cleanHtml = bodyHtml
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<link[^>]*>/gi, "");

          chapters.push({
            index: i,
            title: chapterTitle,
            htmlContent: cleanHtml,
          });
        }
      }
    }
  }

  // Fallback: if no chapters found, try reading any HTML files
  if (chapters.length === 0) {
    const htmlFiles: string[] = [];
    zip.forEach((path) => {
      if (path.endsWith(".html") || path.endsWith(".xhtml")) {
        htmlFiles.push(path);
      }
    });
    htmlFiles.sort();

    for (let i = 0; i < htmlFiles.length; i++) {
      const file = zip.file(htmlFiles[i]);
      if (!file) continue;

      const html = await file.async("string");
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      const cleanHtml = (bodyMatch ? bodyMatch[1] : html)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

      chapters.push({
        index: i,
        title: `Chapter ${i + 1}`,
        htmlContent: cleanHtml,
      });
    }
  }

  return { title: bookTitle, author: bookAuthor, chapters };
}

export function EpubPreview({ content, fileName }: EpubPreviewProps) {
  const [bookData, setBookData] = useState<Awaited<ReturnType<typeof parseEpub>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);

  const parseFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await parseEpub(content);
      setBookData(result);
    } catch (err) {
      console.error("Error parsing EPUB:", err);
      setError(err instanceof Error ? err.message : "Failed to parse e-book");
    } finally {
      setLoading(false);
    }
  }, [content]);

  useEffect(() => { parseFile(); }, [parseFile]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Loading e-book...</p>
      </div>
    );
  }

  if (error || !bookData) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-destructive gap-3">
        <p className="text-lg font-medium">Failed to Load E-book</p>
        <p className="text-sm text-muted-foreground">{error || "Unknown error"}</p>
      </div>
    );
  }

  if (bookData.chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
        <BookOpen size={48} />
        <p className="text-lg font-medium">No Chapters Found</p>
      </div>
    );
  }

  const chapter = bookData.chapters[currentChapter];

  return (
    <div className="flex flex-col h-full">
      {/* Book info bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {bookData.title || fileName}
            </span>
            {bookData.author && (
              <span className="text-xs text-muted-foreground">by {bookData.author}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Chapter {currentChapter + 1} / {bookData.chapters.length}
          </span>
        </div>
      </div>

      {/* Chapter navigation */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b overflow-x-auto">
        {bookData.chapters.map((ch, i) => (
          <button
            key={i}
            onClick={() => setCurrentChapter(i)}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
              i === currentChapter
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {ch.title.length > 25 ? ch.title.slice(0, 22) + "..." : ch.title}
          </button>
        ))}
      </div>

      {/* Chapter content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-6 text-foreground">{chapter.title}</h2>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: chapter.htmlContent }}
          />
        </div>
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
        <button
          onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
          disabled={currentChapter === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          {currentChapter + 1} / {bookData.chapters.length}
        </span>
        <button
          onClick={() => setCurrentChapter(Math.min(bookData.chapters.length - 1, currentChapter + 1))}
          disabled={currentChapter === bookData.chapters.length - 1}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
