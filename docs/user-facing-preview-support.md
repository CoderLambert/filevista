# FileVista Preview Support

This document describes which file types FileVista currently supports, which are limited, and which are not supported.

## Fully Supported

| Category | Extensions | Notes |
|---|---|---|
| PDF | .pdf | Browser-side PDF.js rendering |
| Code | .js/.ts/.tsx/.py/.go etc. | Syntax highlighting via Shiki |
| Text | .txt/.log/.env | Plain text preview |
| Markdown | .md/.mdx | GFM rendering |
| JSON | .json | Formatted source preview (reuses source-code plugin) |
| CSV | .csv | Table preview |
| Image | .png/.jpg/.webp/.gif/.svg | Browser-native preview |
| Audio | .mp3/.wav/.ogg | Native audio player |
| Video | .mp4/.webm/.mov | Native video player |
| Office | .docx/.pptx/.xlsx | Modern Office formats |
| Archive | .zip | Archive preview |
| EPUB | .epub | EPUB reader |
| RTF | .rtf | Text extraction preview |
| HTML | .html/.htm | Safe preview + source code |

## Limited / Unsupported

| Type | Status | Reason | Suggestion |
|---|---|---|---|
| .doc | Limited | Legacy Word binary format | Convert to .docx |
| .ppt | Unsupported | Legacy PowerPoint binary format | Convert to .pptx |
| .xls | Unsupported | Legacy Excel binary format | Convert to .xlsx |
| unknown | Unsupported | Cannot identify file type | Download or use another tool |

## Large Files

For large PDF / DOCX / PPTX / XLSX / ZIP / EPUB files (>= 20MB), FileVista may show a large file hint.

This does not block preview. It only indicates that browser-side parsing may take longer, and the page may briefly become unresponsive during parsing.

## Remote URL Preview

FileVista supports remote file URL preview when the target server allows browser-side cross-origin access.

Paste a remote file URL in the sidebar input, for example:

```txt
https://example.com/file.pdf
https://example.com/file.docx
https://example.com/file.xlsx
```

Download-style URLs are also supported when the filename can be resolved from query parameters or response headers:

```txt
https://example.com/download?showname=demo.docx&filename=xxx.docx
```

If a remote URL fails to load, possible reasons include:

```txt
1. The URL is invalid or not http/https
2. The file is not publicly accessible
3. The target server does not allow browser CORS access
4. The file type is unsupported
```

Remote URL preview is purely browser-side. FileVista cannot bypass CORS restrictions on GitHub Pages.

## Privacy

FileVista reads and parses files entirely in the browser. Files are never uploaded to any server.
