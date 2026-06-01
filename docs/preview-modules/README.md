# 预览模块技术拆解

本目录包含 File Preview Hub 的 17 个预览组件的详细技术文档，按文件类型分组组织。

## 模块索引

| 目录 | 组件 | 文件类型 | 核心依赖 |
|------|------|---------|---------|
| [pdf/](./pdf/) | PdfPreview | PDF | pdfjs-dist |
| [markdown/](./markdown/) | MarkdownPreview | MD/MDX | react-markdown, remark-gfm |
| [json-code/](./json-code/) | CodePreview | JSON/代码 | react-syntax-highlighter |
| [docx/](./docx/) | DocxPreview | DOCX | mammoth |
| [doc/](./doc/) | DocPreview | DOC | mammoth |
| [pptx/](./pptx/) | PptxPreview | PPTX/PPT | jszip |
| [xlsx/](./xlsx/) | XlsxPreview | XLSX/XLS | exceljs |
| [epub/](./epub/) | EpubPreview | EPUB | jszip |
| [html-zip/](./html-zip/) | HtmlPreview, ZipPreview | HTML, ZIP | DOMParser, jszip |
| [csv/](./csv/) | CsvPreview | CSV | 原生 JS |
| [text/](./text/) | TextPreview | TXT/LOG/ENV | 原生 JS |
| [image/](./image/) | ImagePreview | PNG/JPG/GIF/WebP | HTML5 |
| [media/](./media/) | VideoPreview, AudioPreview | 视频/音频 | HTML5 |
| [svg-rtf/](./svg-rtf/) | SvgPreview, RtfPreview | SVG, RTF | 原生 JS |

## 统一接口设计

所有预览组件遵循统一的接口模式：

```typescript
// 文本内容型组件（PDF, DOCX, XLSX, EPUB 等）
interface BinaryPreviewProps {
  content: string;    // base64 编码的文件内容
  fileName: string;
}

// 纯文本型组件（Markdown, Code, CSV, HTML 等）
interface TextPreviewProps {
  content: string;    // 文本字符串
  fileName: string;
}

// URL 引用型组件（Image, Video, Audio）
interface UrlPreviewProps {
  url: string;        // Object URL
  fileName: string;
}
```

## 路由分发

`FilePreviewRenderer` 通过 `switch(fileType)` 将 `FileInfo` 路由到对应的预览组件：

```
FileInfo.fileType
    │
    ├── pdf      → PdfPreview(content=base64)
    ├── markdown → MarkdownPreview(content=text)
    ├── json     → CodePreview(content=text, isJson=true)
    ├── code     → CodePreview(content=text)
    ├── docx     → DocxPreview(content=base64)
    ├── doc      → DocPreview(content=base64)
    ├── pptx     → PptxPreview(content=base64)
    ├── xlsx     → XlsxPreview(content=base64)
    ├── epub     → EpubPreview(content=base64)
    ├── html     → HtmlPreview(content=text)
    ├── zip      → ZipPreview(content=base64)
    ├── svg      → SvgPreview(content=text)
    ├── rtf      → RtfPreview(content=text)
    ├── image    → ImagePreview(url=ObjectURL)
    ├── text     → TextPreview(content=text)
    ├── csv      → CsvPreview(content=text)
    ├── video    → VideoPreview(url=ObjectURL)
    ├── audio    → AudioPreview(url=ObjectURL)
    └── unknown  → UnsupportedPreview
```

## 通用模式

### 加载状态
所有组件均提供 `loading` 状态 UI：
```tsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
```

### 错误状态
所有组件均提供 `error` 状态 UI：
```tsx
<div className="text-destructive">
  <p>Failed to load</p>
  <p>{error}</p>
</div>
```

### 内容滚动
预览区域统一使用 `overflow-auto` 确保内容可滚动：
```tsx
<div className="flex-1 overflow-auto">...</div>
```
