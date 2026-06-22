"use client";


import { useEffect, useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
} from "./icons";
import { base64ToUint8Array } from "./utils";
import { useLocale } from "./core/i18n";
import "./styles/EpubPreview.css";

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
  const bytes = base64ToUint8Array(base64Content);

  const zip = await JSZip.loadAsync(bytes);
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
  const t = useLocale();

  // Reset state when content changes — derived state during render
  const [prevContent, setPrevContent] = useState(content);
  if (prevContent !== content) {
    setPrevContent(content);
    setLoading(true);
    setError(null);
    setBookData(null);
    setCurrentChapter(0);
    setSearchResults([]);
  }

  useEffect(() => {
    let cancelled = false;
    parseEpub(content).then(
      (result) => {
        if (cancelled) return;
        setBookData(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Error parsing EPUB:", err);
        setError(err instanceof Error ? err.message : "Failed to parse e-book");
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [content]);

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
      <div className="fv-epub__state fv-epub__state--loading">
        <div className="fv-spinner fv-spinner--lg" />
        <p className="fv-epub__state-msg">{t.loadingEbook}</p>
      </div>
    );
  }

  if (error || !bookData) {
    return (
      <div className="fv-epub__state fv-epub__state--error">
        <BookOpenIcon size={48} className="fv-epub__state-icon" />
        <p className="fv-epub__state-title">{t.ebookLoadFailed}</p>
        <p className="fv-epub__state-msg">{error || t.unknownError}</p>
      </div>
    );
  }

  if (bookData.chapters.length === 0) {
    return (
      <div className="fv-epub__state fv-epub__state--empty">
        <BookOpenIcon size={48} />
        <p className="fv-epub__state-title">{t.noChaptersFound}</p>
      </div>
    );
  }

  const chapter = bookData.chapters[currentChapter];

  // Build combined CSS for inline injection
  // Override any absolute positioning or overflow issues in book CSS
  const combinedCss = bookData.stylesheets.join("\n") + `
    /* Override book styles that may cause horizontal overflow */
    .fv-epub__article * {
      max-width: 100% !important;
      overflow-wrap: break-word !important;
      word-wrap: break-word !important;
    }
    .fv-epub__article pre, .fv-epub__article code {
      overflow-x: auto !important;
      max-width: 100% !important;
    }
    .fv-epub__article img {
      max-width: 100% !important;
      height: auto !important;
    }
    .fv-epub__article table {
      display: block;
      overflow-x: auto;
      max-width: 100%;
    }
  `;

  return (
    <div className="fv-epub">
      {/* Book info bar */}
      <div className="fv-epub__info-bar">
        <div className="fv-epub__info-row">
          <div className="fv-epub__info-left">
            <BookOpenIcon size={14} className="fv-epub__info-icon" />
            <span className="fv-epub__info-title">
              {bookData.title || fileName}
            </span>
            {bookData.author && (
              <span className="fv-epub__info-author">
                — {bookData.author}
              </span>
            )}
          </div>
          <div className="fv-epub__info-right">
            {/* Search */}
            <div className="fv-epub__search-wrap">
              <SearchIcon size={14} className="fv-epub__search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="fv-epub__search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="fv-epub__search-clear"
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
            {/* TOC toggle */}
            <button
              onClick={() => setShowToc(!showToc)}
              className={`fv-epub__toc-btn ${showToc ? "fv-epub__toc-btn--active" : ""}`}
              title={t.tableOfContents}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="fv-epub__search-results">
          <p className="fv-epub__search-results-label">
            {t.foundInChapters.replace("{count}", searchResults.length.toLocaleString())}
          </p>
          <div className="fv-epub__search-results-list">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentChapter(r.chapterIndex);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="fv-epub__search-result-item"
              >
                <span className="fv-epub__search-result-title">
                  {bookData.chapters[r.chapterIndex].title}
                </span>
                <span className="fv-epub__search-result-snippet">{r.snippet}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && (
        <div className="fv-epub__search-empty">
          <p className="fv-epub__search-empty-text">{t.noResultsFound}</p>
        </div>
      )}

      <div className="fv-epub__body">
        {/* TOC sidebar */}
        {showToc && (
          <div className="fv-epub__toc-sidebar">
            <div className="fv-epub__toc-inner">
              <h3 className="fv-epub__toc-heading">
                {t.tableOfContents}
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
                <div className="fv-epub__toc-list">
                  {bookData.chapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentChapter(i)}
                      className={`fv-epub__toc-item ${i === currentChapter ? "fv-epub__toc-item--active" : ""}`}
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
        <div className="fv-epub__main">
          {/* Compact chapter selector bar */}
          <div className="fv-epub__chapter-bar">
            <button
              onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="fv-epub__chapter-nav-btn"
            >
              <ChevronLeftIcon size={16} />
            </button>

            {/* Chapter dropdown */}
            <div className="fv-epub__dropdown-wrap" ref={dropdownRef}>
              <button
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className="fv-epub__dropdown-trigger"
              >
                <span className="fv-epub__dropdown-index">
                  {currentChapter + 1}/{bookData.chapters.length}
                </span>
                <span className="fv-epub__dropdown-title">
                  {chapter.title}
                </span>
                <ChevronDownIcon
                  size={14}
                  className={`fv-epub__dropdown-chevron ${showChapterDropdown ? "fv-epub__dropdown-chevron--open" : ""}`}
                />
              </button>

              {/* Dropdown list */}
              {showChapterDropdown && (
                <div className="fv-epub__dropdown-list">
                  {bookData.chapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentChapter(i);
                        setShowChapterDropdown(false);
                      }}
                      className={`fv-epub__dropdown-item ${i === currentChapter ? "fv-epub__dropdown-item--active" : ""}`}
                    >
                      <span className="fv-epub__dropdown-item-index">{i + 1}.</span>
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
              className="fv-epub__chapter-nav-btn"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>

          {/* Chapter content */}
          <div className="fv-epub__content" ref={contentRef} onClick={handleContentClick}>
            <div className="fv-epub__content-inner">
              <h2 className="fv-epub__chapter-title">{chapter.title}</h2>
              {/* Inject book CSS */}
              {combinedCss && (
                <style dangerouslySetInnerHTML={{ __html: combinedCss }} />
              )}
              <div
                className="fv-epub__article"
                dangerouslySetInnerHTML={{ __html: chapter.htmlContent }}
              />
            </div>
          </div>

          {/* Navigation footer */}
          <div className="fv-epub__footer">
            <button
              onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="fv-epub__footer-btn"
            >
              <ChevronLeftIcon size={16} />
              <span className="fv-epub__footer-btn-text">{t.previous}</span>
            </button>
            <span className="fv-epub__footer-label">
              {currentChapter + 1} / {bookData.chapters.length}
            </span>
            <button
              onClick={() =>
                setCurrentChapter(Math.min(bookData.chapters.length - 1, currentChapter + 1))
              }
              disabled={currentChapter === bookData.chapters.length - 1}
              className="fv-epub__footer-btn"
            >
              <span className="fv-epub__footer-btn-text">{t.next}</span>
              <ChevronRightIcon size={16} />
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
    <div className={depth > 0 ? "fv-epub__toc-indent" : "fv-epub__toc-list"}>
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
              className={`fv-epub__toc-item ${isCurrent ? "fv-epub__toc-item--active" : ""}`}
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
