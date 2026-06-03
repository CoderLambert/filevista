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

## Privacy

FileVista reads and parses files entirely in the browser. Files are never uploaded to any server.
