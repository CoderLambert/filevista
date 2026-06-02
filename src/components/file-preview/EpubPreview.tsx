"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  X,
  ChevronDown,
} from "lucide-react";

interface EpubPreviewProps {
  content: string; // base64 encoded
  fileName: string;
}

interface EpubChapter {
  index: number;
  title: string;
  htmlContent: string;
  filePath: string;
}

interface TocItem {
  title: string;
  src: string;
  children?: TocItem[];
}

async function parseEpub(base64Content: string): Promise<{
  title: string;
  author: string;
  chapters: EpubChapter[];
  toc: TocItem[];
  stylesheets: string[];
  imageMap: Record<string, string>; // relative path -> blob URL
}> {
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes.buffer);
  const chapters: EpubChapter[] = [];
  const toc: TocItem[] = [];
  let bookTitle = "";
  let bookAuthor = "";
  const stylesheets: string[] = [];
  const imageMap: Record<string, string> = {};

  // Helper: extract XML tag attributes (order-independent)
  function getAttr(tag: string, attrName: string): string | null {
    const re = new RegExp(`${attrName}="([^"]*)"`, "i");
    const m = tag.match(re);
    return m ? m[1] : null;
  }

  // Helper: resolve relative path against a base directory
  function resolvePath(baseDir: string, relativePath: string): string {
    if (relativePath.startsWith("/")) return relativePath.substring(1);
    // Decode URL-encoded paths (e.g. %20 -> space)
    const decoded = decodeURIComponent(relativePath);
    // Handle anchor-only references
    const pathPart = decoded.split("#")[0];
    if (!pathPart) return baseDir;
    const baseParts = baseDir.split("/").filter(Boolean);
    const relParts = pathPart.split("/");
    for (const part of relParts) {
      if (part === "..") {
        baseParts.pop();
      } else if (part !== "." && part !== "") {
        baseParts.push(part);
      }
    }
    return baseParts.join("/");
  }

  // Helper: try to find a file in the zip with flexible matching
  function findZipFile(path: string): JSZip.JSZipObject | null {
    // Try exact match first
    let f = zip.file(path);
    if (f) return f;
    // Try with URL decoding
    try {
      f = zip.file(decodeURIComponent(path));
      if (f) return f;
    } catch {}
    // Try case-insensitive search
    const lowerPath = path.toLowerCase();
    let found: JSZip.JSZipObject | null = null;
    zip.forEach((p, file) => {
      if (!found && p.toLowerCase() === lowerPath) {
        found = file;
      }
    });
    return found;
  }

  // ── Step 1: Build image map (blob URLs for all images) ──
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp"];
  const imagePromises: Promise<void>[] = [];
  zip.forEach((path, file) => {
    if (file.dir) return;
    const lowerPath = path.toLowerCase();
    if (imageExtensions.some((ext) => lowerPath.endsWith(ext))) {
      imagePromises.push(
        (async () => {
          try {
            const blob = await file.async("blob");
            const url = URL.createObjectURL(blob);
            // Map both full path and filename-only
            imageMap[path] = url;
            const filename = path.split("/").pop()!;
            imageMap[filename] = url;
            // Also store lowercase versions for case-insensitive matching
            imageMap[lowerPath] = url;
            imageMap[filename.toLowerCase()] = url;
          } catch {
            // skip unreadable images
          }
        })()
      );
    }
  });
  await Promise.all(imagePromises);

  // ── Step 2: Parse container.xml → OPF ──
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("Invalid EPUB: missing container.xml");
  }

  const containerXml = await containerFile.async("string");
  const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootfileMatch) {
    throw new Error("Invalid EPUB: no rootfile in container.xml");
  }

  const opfPath = rootfileMatch[1];
  const opfFile = findZipFile(opfPath);
  if (!opfFile) {
    throw new Error("Invalid EPUB: OPF file not found");
  }

  const opfXml = await opfFile.async("string");
  const opfDir = opfPath.includes("/")
    ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1)
    : "";

  // Extract title & author
  const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/);
  if (titleMatch) bookTitle = titleMatch[1].trim();
  const authorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/);
  if (authorMatch) bookAuthor = authorMatch[1].trim();

  // ── Step 3: Parse manifest (order-independent attribute extraction) ──
  const manifestMatch = opfXml.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/);
  const manifestMap: Record<string, { href: string; mediaType: string }> = {};
  const manifestHrefToId: Record<string, string> = {};
  if (manifestMatch) {
    const itemRegex = /<item\s+([^>]+?)\/?>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(manifestMatch[1])) !== null) {
      const attrs = itemMatch[1];
      const id = getAttr(attrs, "id");
      const href = getAttr(attrs, "href");
      const mediaType = getAttr(attrs, "media-type") || "";
      if (id && href) {
        manifestMap[id] = { href, mediaType };
        manifestHrefToId[href] = id;
      }
    }
  }

  // ── Step 4: Parse spine (reading order) ──
  const spineMatch = opfXml.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
  const spineItems: string[] = [];
  if (spineMatch) {
    const itemrefRegex = /<itemref\s+([^>]+?)\/?>/g;
    let refMatch;
    while ((refMatch = itemrefRegex.exec(spineMatch[1])) !== null) {
      const idref = getAttr(refMatch[1], "idref");
      if (idref) spineItems.push(idref);
    }
  }

  // ── Step 5: Parse TOC from toc.ncx ──
  const spineTocAttr = spineMatch
    ? (spineMatch[0].match(/toc="([^"]+)"/)?.[1] ?? null)
    : null;
  if (spineTocAttr) {
    const tocInfo = manifestMap[spineTocAttr];
    if (tocInfo) {
      const tocPath = resolvePath(opfDir, tocInfo.href);
      const tocFile = findZipFile(tocPath);
      if (tocFile) {
        const tocXml = await tocFile.async("string");
        // Parse navPoints recursively
        function parseNavPoints(xml: string, parentPath: string): TocItem[] {
          const items: TocItem[] = [];
          const navRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/g;
          let navMatch;
          while ((navMatch = navRegex.exec(xml)) !== null) {
            const block = navMatch[1];
            const labelMatch = block.match(
              /<navLabel[^>]*>[\s\S]*?<text>([^<]*)<\/text>/
            );
            const contentMatch = block.match(/<content\s+src="([^"]+)"/);
            if (labelMatch && contentMatch) {
              const src = contentMatch[1].split("#")[0]; // remove anchor
              const item: TocItem = {
                title: labelMatch[1].trim(),
                src: resolvePath(parentPath, src),
              };
              // Parse children
              const children = parseNavPoints(block, parentPath);
              if (children.length > 0) item.children = children;
              items.push(item);
            }
          }
          return items;
        }
        const parsed = parseNavPoints(tocXml, opfDir);
        toc.push(...parsed);
      }
    }
  }

  // ── Step 6: Collect CSS stylesheets ──
  for (const [, info] of Object.entries(manifestMap)) {
    if (info.mediaType === "text/css" || info.href.endsWith(".css")) {
      const cssPath = resolvePath(opfDir, info.href);
      const cssFile = findZipFile(cssPath);
      if (cssFile) {
        try {
          const cssText = await cssFile.async("string");
          stylesheets.push(cssText);
        } catch {
          // skip unreadable CSS
        }
      }
    }
  }

  // ── Step 7: Build a TOC src → title map for better chapter titles ──
  const tocTitleMap: Record<string, string> = {};
  function flattenToc(items: TocItem[]) {
    for (const item of items) {
      if (item.title) {
        tocTitleMap[item.src] = item.title;
        // Also map just the filename
        const filename = item.src.split("/").pop()!;
        tocTitleMap[filename] = item.title;
      }
      if (item.children) flattenToc(item.children);
    }
  }
  flattenToc(toc);

  // ── Step 8: Read chapters in spine order ──
  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i];
    const info = manifestMap[idref];
    if (!info) continue;

    const filePath = resolvePath(opfDir, info.href);
    const chapterFile = findZipFile(filePath);
    if (!chapterFile) continue;

    const chapterXml = await chapterFile.async("string");

    // Get chapter title: TOC > h1/h2/h3 > <title> > fallback
    let chapterTitle = `Chapter ${i + 1}`;
    // Try TOC first (most accurate)
    const tocTitle =
      tocTitleMap[filePath] ||
      tocTitleMap[filePath.toLowerCase()] ||
      tocTitleMap[info.href] ||
      tocTitleMap[info.href.toLowerCase()];
    if (tocTitle) {
      chapterTitle = tocTitle;
    } else {
      // Try h1/h2/h3
      const hMatch = chapterXml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/);
      if (hMatch && hMatch[1].trim()) {
        // Strip HTML tags from heading
        chapterTitle = hMatch[1].replace(/<[^>]+>/g, "").trim();
      } else {
        const titleTagMatch = chapterXml.match(/<title>([^<]*)<\/title>/);
        if (titleTagMatch && titleTagMatch[1].trim()) {
          chapterTitle = titleTagMatch[1].trim();
        }
      }
    }

    // Extract body content
    const bodyMatch = chapterXml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    let bodyHtml = bodyMatch ? bodyMatch[1] : chapterXml;

    // Clean up: remove scripts only, keep styles for proper rendering
    bodyHtml = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove page-break divs that calibre adds
      .replace(/<div\s+class="mbp_pagebreak"[^>]*><\/div>/gi, "");

    // Resolve relative image paths in HTML to blob URLs
    const chapterDir = filePath.includes("/")
      ? filePath.substring(0, filePath.lastIndexOf("/") + 1)
      : "";
    bodyHtml = bodyHtml.replace(
      /(<img\s+[^>]*?)src="([^"]+)"/gi,
      (_match, prefix, src) => {
        // Skip external URLs
        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
          return `${prefix}src="${src}"`;
        }
        const resolvedSrc = resolvePath(chapterDir, src);
        const blobUrl =
          imageMap[resolvedSrc] ||
          imageMap[resolvedSrc.toLowerCase()] ||
          imageMap[src] ||
          imageMap[src.toLowerCase()] ||
          imageMap[src.split("/").pop()!] ||
          imageMap[src.split("/").pop()!.toLowerCase()];
        if (blobUrl) {
          return `${prefix}src="${blobUrl}"`;
        }
        return `${prefix}src="${src}"`;
      }
    );

    // Resolve relative anchor links to chapter navigation
    bodyHtml = bodyHtml.replace(
      /(<a\s+[^>]*?)href="([^"]+)"/gi,
      (_match, prefix, href) => {
        if (
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("#") ||
          href.startsWith("mailto:")
        ) {
          return `${prefix}href="${href}"`;
        }
        // Mark internal links with data attribute for handling
        const resolvedHref = resolvePath(chapterDir, href.split("#")[0]);
        const anchor = href.includes("#") ? "#" + href.split("#")[1] : "";
        return `${prefix}href="${resolvedHref}${anchor}" data-epub-link="true"`;
      }
    );

    chapters.push({
      index: i,
      title: chapterTitle,
      htmlContent: bodyHtml,
      filePath,
    });
  }

  // ── Fallback: if no chapters via OPF, scan all HTML files ──
  if (chapters.length === 0) {
    const htmlFiles: string[] = [];
    zip.forEach((path) => {
      if (path.endsWith(".html") || path.endsWith(".xhtml") || path.endsWith(".htm")) {
        htmlFiles.push(path);
      }
    });
    htmlFiles.sort();

    for (let i = 0; i < htmlFiles.length; i++) {
      const file = zip.file(htmlFiles[i]);
      if (!file) continue;

      const html = await file.async("string");
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      let bodyHtml = (bodyMatch ? bodyMatch[1] : html)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<div\s+class="mbp_pagebreak"[^>]*><\/div>/gi, "");

      // Resolve images in fallback mode too
      const chapterDir = htmlFiles[i].includes("/")
        ? htmlFiles[i].substring(0, htmlFiles[i].lastIndexOf("/") + 1)
        : "";
      bodyHtml = bodyHtml.replace(
        /(<img\s+[^>]*?)src="([^"]+)"/gi,
        (_match, prefix, src) => {
          if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
            return `${prefix}src="${src}"`;
          }
          const resolvedSrc = resolvePath(chapterDir, src);
          const blobUrl =
            imageMap[resolvedSrc] ||
            imageMap[resolvedSrc.toLowerCase()] ||
            imageMap[src] ||
            imageMap[src.toLowerCase()];
          if (blobUrl) {
            return `${prefix}src="${blobUrl}"`;
          }
          return `${prefix}src="${src}"`;
        }
      );

      // Try TOC for title
      const tocTitle =
        tocTitleMap[htmlFiles[i]] || tocTitleMap[htmlFiles[i].toLowerCase()];
      const hMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/);
      let chTitle = `Chapter ${i + 1}`;
      if (tocTitle) {
        chTitle = tocTitle;
      } else if (hMatch && hMatch[1].trim()) {
        chTitle = hMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      chapters.push({
        index: i,
        title: chTitle,
        htmlContent: bodyHtml,
        filePath: htmlFiles[i],
      });
    }
  }

  return { title: bookTitle, author: bookAuthor, chapters, toc, stylesheets, imageMap };
}

export function EpubPreview({ content, fileName }: EpubPreviewProps) {
  const [bookData, setBookData] = useState<Awaited<ReturnType<typeof parseEpub>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ chapterIndex: number; snippet: string }[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    parseFile();
  }, [parseFile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowChapterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (bookData?.imageMap) {
        Object.values(bookData.imageMap).forEach((url) => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
      }
    };
  }, [bookData?.imageMap]);

  // Scroll to top when chapter changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentChapter]);

  // Search functionality
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!bookData || !query.trim()) {
        setSearchResults([]);
        return;
      }
      const lowerQuery = query.toLowerCase();
      const results: { chapterIndex: number; snippet: string }[] = [];
      for (let i = 0; i < bookData.chapters.length; i++) {
        // Strip HTML for text search
        const text = bookData.chapters[i].htmlContent.replace(/<[^>]+>/g, "");
        const idx = text.toLowerCase().indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(text.length, idx + query.length + 30);
          const snippet =
            (start > 0 ? "..." : "") +
            text.substring(start, end) +
            (end < text.length ? "..." : "");
          results.push({ chapterIndex: i, snippet });
          if (results.length >= 20) break; // limit results
        }
      }
      setSearchResults(results);
    },
    [bookData]
  );

  // Handle internal EPUB link clicks
  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor || !bookData) return;

      const isEpubLink = anchor.getAttribute("data-epub-link") === "true";
      if (isEpubLink) {
        e.preventDefault();
        const href = anchor.getAttribute("href") || "";
        const targetPath = href.split("#")[0];
        // Find the chapter that matches this path
        const chapterIdx = bookData.chapters.findIndex(
          (ch) =>
            ch.filePath === targetPath ||
            ch.filePath.toLowerCase() === targetPath.toLowerCase()
        );
        if (chapterIdx !== -1) {
          setCurrentChapter(chapterIdx);
          setTimeout(() => {
            if (contentRef.current) contentRef.current.scrollTop = 0;
          }, 100);
        }
      }
    },
    [bookData]
  );

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
        <BookOpen size={48} className="opacity-50" />
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

  // Build combined CSS for inline injection
  // Override any absolute positioning or overflow issues in book CSS
  const combinedCss = bookData.stylesheets.join("\n") + `
    /* Override book styles that may cause horizontal overflow */
    .epub-content * {
      max-width: 100% !important;
      overflow-wrap: break-word !important;
      word-wrap: break-word !important;
    }
    .epub-content pre, .epub-content code {
      overflow-x: auto !important;
      max-width: 100% !important;
    }
    .epub-content img {
      max-width: 100% !important;
      height: auto !important;
    }
    .epub-content table {
      display: block;
      overflow-x: auto;
      max-width: 100%;
    }
  `;

  return (
    <div className="flex flex-col h-full">
      {/* Book info bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BookOpen size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {bookData.title || fileName}
            </span>
            {bookData.author && (
              <span className="text-xs text-muted-foreground shrink-0">
                — {bookData.author}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-28 sm:w-48 rounded-md border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                  <X size={12} className="text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            {/* TOC toggle */}
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-1.5 rounded-md transition-colors ${
                showToc
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title="Table of Contents"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/20 max-h-40 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-1">
            Found in {searchResults.length} chapter(s)
          </p>
          <div className="space-y-1">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentChapter(r.chapterIndex);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="block w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors"
              >
                <span className="font-medium text-primary">
                  {bookData.chapters[r.chapterIndex].title}
                </span>
                <span className="text-muted-foreground ml-2">{r.snippet}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && (
        <div className="px-4 py-2 border-b bg-muted/20">
          <p className="text-xs text-muted-foreground">No results found</p>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* TOC sidebar */}
        {showToc && (
          <div className="w-56 sm:w-64 shrink-0 border-r overflow-y-auto bg-background">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Table of Contents
              </h3>
              <TocTree
                items={bookData.toc}
                chapters={bookData.chapters}
                currentChapter={currentChapter}
                onSelect={(idx) => {
                  setCurrentChapter(idx);
                  setShowChapterDropdown(false);
                }}
              />
              {/* Fallback: if no TOC items, show chapter list */}
              {bookData.toc.length === 0 && (
                <div className="space-y-0.5">
                  {bookData.chapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentChapter(i)}
                      className={`block w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                        i === currentChapter
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {ch.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Compact chapter selector bar */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0">
            <button
              onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Chapter dropdown */}
            <div className="relative flex-1 min-w-0" ref={dropdownRef}>
              <button
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-left"
              >
                <span className="text-muted-foreground shrink-0">
                  {currentChapter + 1}/{bookData.chapters.length}
                </span>
                <span className="truncate font-medium text-foreground">
                  {chapter.title}
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-muted-foreground transition-transform ${
                    showChapterDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown list */}
              {showChapterDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                  {bookData.chapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentChapter(i);
                        setShowChapterDropdown(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === currentChapter
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="text-muted-foreground/60 mr-1.5">{i + 1}.</span>
                      {ch.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() =>
                setCurrentChapter(Math.min(bookData.chapters.length - 1, currentChapter + 1))
              }
              disabled={currentChapter === bookData.chapters.length - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Chapter content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={contentRef} onClick={handleContentClick}>
            <div className="max-w-3xl mx-auto p-4 sm:p-8">
              <h2 className="text-xl font-bold mb-6 text-foreground">{chapter.title}</h2>
              {/* Inject book CSS */}
              {combinedCss && (
                <style dangerouslySetInnerHTML={{ __html: combinedCss }} />
              )}
              <div
                className="epub-content prose prose-sm dark:prose-invert max-w-none
                  [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2
                  [&_table]:w-full [&_table]:border-collapse
                  [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs
                  [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:bg-muted [&_th]:text-xs [&_th]:font-medium
                  [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a:hover]:decoration-primary
                  [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic
                  [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                  [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto
                  [&_.mbp_pagebreak]:hidden
                  [&_p]:break-words [&_span]:break-words
                  [&_div]:break-words"
                dangerouslySetInnerHTML={{ __html: chapter.htmlContent }}
              />
            </div>
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 shrink-0">
            <button
              onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="text-xs text-muted-foreground">
              {currentChapter + 1} / {bookData.chapters.length}
            </span>
            <button
              onClick={() =>
                setCurrentChapter(Math.min(bookData.chapters.length - 1, currentChapter + 1))
              }
              disabled={currentChapter === bookData.chapters.length - 1}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TOC Tree Component ──
function TocTree({
  items,
  chapters,
  currentChapter,
  onSelect,
  depth = 0,
}: {
  items: TocItem[];
  chapters: EpubChapter[];
  currentChapter: number;
  onSelect: (index: number) => void;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "ml-3 border-l border-border pl-2" : "space-y-0.5"}>
      {items.map((item, i) => {
        // Find matching chapter index
        const chapterIdx = chapters.findIndex(
          (ch) =>
            ch.filePath === item.src ||
            ch.filePath.toLowerCase() === item.src.toLowerCase() ||
            item.src.endsWith(ch.filePath.split("/").pop()!) ||
            ch.filePath.endsWith(item.src.split("/").pop()!)
        );
        const isCurrent = chapterIdx === currentChapter;

        return (
          <div key={`${depth}-${i}`}>
            <button
              onClick={() => {
                if (chapterIdx !== -1) onSelect(chapterIdx);
              }}
              disabled={chapterIdx === -1}
              className={`block w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                isCurrent
                  ? "bg-primary/10 text-primary font-medium"
                  : chapterIdx === -1
                  ? "text-muted-foreground/50 cursor-default"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={{ paddingLeft: `${8 + depth * 4}px` }}
            >
              {item.title}
            </button>
            {item.children && item.children.length > 0 && (
              <TocTree
                items={item.children}
                chapters={chapters}
                currentChapter={currentChapter}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
