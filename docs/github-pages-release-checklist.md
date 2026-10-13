# GitHub Pages Release Checklist

## 1. Check Actions

Open:

```txt
Actions → Deploy GitHub Pages
```

Expected:

```txt
Build static site ✅
Deploy static site ✅
```

## 2. Visit Site

Open:

```txt
https://coderlambert.github.io/filevista/
```

Expected:

```txt
Page loads correctly
No blank screen
No obvious 404 on static assets
```

## 3. Check Demo Files

Click:

```txt
Demo Files
```

Expected:

```txt
Text demos load normally
DOCX demo loads normally
XLSX demo loads normally
EPUB demo loads normally
```

Binary demo files are served from `/demo/...` with `NEXT_PUBLIC_BASE_PATH` prefix, so the main concern is whether these resources return 404 on Pages.

## 4. Check PDF Worker

Upload a PDF file.

Expected:

```txt
PDF renders correctly
No 404 for /filevista/vendor/pdfjs/pdf.worker.min.mjs
```

## 5. Check Plugin Renderer

Switch to Plugin Renderer.

Expected:

```txt
PDF → builtin.pdf
JSON → builtin.source-code
DOCX → builtin.docx
PPTX → builtin.pptx
XLSX → builtin.xlsx
```

## 6. Check Remote URL Preview

Paste a remote DOCX URL:

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

Also test a download-style URL:

```txt
https://www.cnipa.gov.cn/module/download/downfile.jsp?classid=0&showname=3%EF%BC%8E%E6%8E%A8%E8%8D%90%E5%87%BD.docx&filename=d79c1d6677e845d0a9d3d6ebe9e5d632.docx
```

Expected:

```txt
Remote file loads successfully when CORS is allowed
DOCX file is detected correctly
Download-style URL uses showname / filename instead of downfile.jsp
Plugin Renderer can render it through builtin.docx
A clear error is shown when CORS is blocked
```

Test invalid URL `abc` — expected: "Please enter a valid URL"
Test unsupported protocol `ftp://example.com/file.docx` — expected: "Only http/https URLs are supported"

## 7. Check Unsupported Types

Test:

```txt
.doc
.ppt
.xls
unknown
```

Expected:

```txt
.doc → degraded / unsupported notice
.ppt → suggestion to convert to .pptx
.xls → suggestion to convert to .xlsx
unknown → Preview Not Available
```

## 8. Check Demo Preview Size Limit (50 MB)

The **Playground demo** has its own policy: warn at 20 MiB, require confirmation at 35 MiB, and block previews above 50 MiB (50 × 1024 × 1024 bytes). The reusable library retains its default thresholds.

Test local PDF / DOCX / PPTX / XLSX / ZIP / EPUB files through both **Browse Files** and drag-and-drop:

| File size | Expected |
| --- | --- |
| Less than 20 MiB | Preview normally |
| 20–under 35 MiB | Show a warning, continue preview |
| 35–50 MiB (inclusive) | Require explicit confirmation before preview |
| Greater than 50 MiB | Block local preview and offer download |

The **remote URL** loader must enforce the same 50 MiB cap before or during download. Verify that a remote file above the limit produces a clear error (subject to CORS). A file exactly 50 MiB must remain eligible for preview.

The limit applies per file, not to the total size of the selected files. Large-file parsing may still be slow or require significant memory even when the size policy allows it.

## 9. Check Browser Console

Open DevTools:

```txt
Console
Network
```

Expected:

```txt
No critical runtime errors
No unexpected 404 under /filevista paths
```
