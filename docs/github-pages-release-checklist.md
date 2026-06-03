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

## 8. Check Large File Hint

Upload a file >= 20MB of type:

```txt
PDF / DOCX / PPTX / XLSX / ZIP / EPUB
```

Expected:

```txt
Large file hint appears
User can still proceed with preview
```

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
