# FileVista

FileVista 是一个纯浏览器端文件预览工具集，基于 Next.js、React 和 TypeScript 构建。

它支持本地文件选择、拖拽上传、多文件切换、文件类型识别和多格式预览。文件处理默认发生在浏览器端，不上传到服务器。

## Features

- 本地 File 预览
- 拖拽上传
- 多文件列表
- TabCache 保持预览状态
- 按格式懒加载预览器
- PDF 预览
- Markdown 预览
- Code / JSON 高亮
- DOCX 预览
- PPTX 预览
- XLSX 预览
- SVG / HTML 预览与源码查看
- 图片 / 音频 / 视频预览

## Getting Started

```bash
bun install
bun run dev
```

访问：

```txt
http://localhost:3000
```

## Supported File Types

| 类型       | 扩展名                        | 状态            |
| -------- | -------------------------- | ------------- |
| PDF      | .pdf                       | 支持            |
| Markdown | .md, .mdx                  | 支持            |
| Code     | .js, .ts, .tsx, .py, .go 等 | 支持            |
| JSON     | .json                      | 支持            |
| DOCX     | .docx                      | 支持            |
| DOC      | .doc                       | 仅文本提取         |
| PPTX     | .pptx                      | 支持            |
| PPT      | .ppt                       | 不支持，建议转 .pptx |
| XLSX     | .xlsx                      | 支持            |
| XLS      | .xls                       | 不支持，建议转 .xlsx |
| HTML     | .html, .htm                | 支持安全预览与源码     |
| SVG      | .svg                       | 支持预览与源码       |
| ZIP      | .zip                       | 支持            |
| EPUB     | .epub                      | 支持            |
| Image    | .png, .jpg, .webp 等        | 支持            |
| Video    | .mp4, .webm 等              | 支持            |
| Audio    | .mp3, .wav 等               | 支持            |
| CSV      | .csv                       | 支持            |
| Text     | .txt, .log, .env 等         | 支持            |

## Known Limitations

* 不支持旧版 PowerPoint 二进制格式 `.ppt`
* 不支持旧版 Excel 二进制格式 `.xls`
* `.doc` 仅支持尽力提取文本，不保证排版、图片和表格
* PPTX 中的 EMF / WMF 图片无法在浏览器中原生显示
* 大型 DOCX / PPTX / XLSX 文件可能导致浏览器卡顿