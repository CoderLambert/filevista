# 技术栈

## 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.1 | 全栈 React 框架（App Router） |
| React | 19.0.0 | UI 组件库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 原子化 CSS 框架 |

## UI 组件库

| 技术 | 版本 | 用途 |
|------|------|------|
| shadcn/ui | New York style | 预制 UI 组件（48 个组件） |
| Radix UI | 各子包独立 | shadcn/ui 底层原语（无障碍访问） |
| Lucide React | 0.525.0 | 图标库 |
| Framer Motion | 12.23.2 | 动画库 |
| Sonner | 2.0.6 | Toast 通知 |
| next-themes | 0.4.6 | 亮色/暗色主题切换 |

## 文件解析库

| 库 | 版本 | 支持格式 | 核心能力 |
|---|------|---------|---------|
| pdfjs-dist | 4.4.168 | PDF | Canvas 渲染、分页、Worker |
| docx-preview | 0.3.7 | DOCX | Word 高保真渲染（字体/颜色/分页/图片） |
| mammoth | 1.12.0 | DOC | 旧版 .doc 文本提取（仅限 .doc 格式） |
| exceljs | 4.4.0 | XLSX | 完整 Excel 解析（样式/合并/图片/注释） |
| jszip | 3.10.1 | ZIP/EPUB/PPTX | ZIP 解压缩、二进制文件提取 |
| react-markdown | 10.1.0 | Markdown | Markdown → React 渲染 |
| remark-gfm | 4.0.1 | Markdown | GFM 扩展（表格/任务列表/删除线） |
| react-syntax-highlighter | 15.6.1 | 代码 | Prism 语法高亮引擎（已移除） |
| shiki | 4.1.0 | 代码/Markdown | VS Code 级语法高亮（懒加载，Markdown 代码块复用） |
| @shikijs/langs | 4.1.0 | 代码 | 50+ 语言按需加载 |
| @shikijs/themes | 4.1.0 | 代码 | GitHub Dark/Light 双主题 |
| @shikijs/transformers | 4.1.0 | 代码 | 行号等 Transformer |

## 数据与状态

| 技术 | 版本 | 用途 |
|------|------|------|
| Prisma | 6.11.1 | ORM（SQLite） |
| Zustand | 5.0.6 | 客户端状态管理（预留） |
| TanStack React Query | 5.82.0 | 服务端状态管理（预留） |
| TanStack React Table | 8.21.3 | 高级表格组件（预留） |

## 工具库

| 库 | 版本 | 用途 |
|---|------|------|
| clsx + tailwind-merge | 2.1.1 / 3.3.1 | `cn()` 条件样式合并 |
| class-variance-authority | 0.7.1 | 组件样式变体 |
| date-fns | 4.1.0 | 日期处理 |
| zod | 4.0.2 | Schema 校验 |
| uuid | 11.1.0 | 唯一 ID 生成 |
| sharp | 0.34.3 | 图片处理（服务端） |

## 开发工具

| 工具 | 用途 |
|------|------|
| Bun | JavaScript 运行时与包管理 |
| ESLint | 代码质量检查 |
| PostCSS | CSS 处理管线 |
| Prisma CLI | 数据库迁移与管理 |

## 运行时环境

| 项目 | 值 |
|------|---|
| 运行时 | Bun |
| 开发端口 | 3000 |
| 数据库 | SQLite (db/custom.db) |
| 包管理 | Bun (bun.lock) |

## 依赖关系图

```
page.tsx
  ├── FileInfo (utils.ts)
  ├── detectFileType (utils.ts)
  ├── DEMO_FILES / fetchBinaryDemoFiles (demos.ts)
  │
  └── FilePreviewRenderer
        ├── PdfPreview ←── pdfjs-dist
        ├── DocxPreview ←── docx-preview
        ├── DocPreview ←── mammoth
        ├── PptxPreview ←── jszip
        ├── XlsxPreview ←── exceljs
        ├── EpubPreview ←── jszip
        ├── ZipPreview ←── jszip
        ├── MarkdownPreview ←── react-markdown + remark-gfm + Shiki (React.lazy 懒加载)
        ├── CodePreview ←── shiki (React.lazy 懒加载)
        ├── ImagePreview ←── HTML5 (Object URL)
        ├── VideoPreview ←── HTML5 (Object URL)
        ├── AudioPreview ←── HTML5 (Object URL)
        ├── CsvPreview ←── 原生 JS
        ├── TextPreview ←── 原生 JS
        ├── HtmlPreview ←── iframe sandbox
        ├── SvgPreview ←── DOM 注入
        └── RtfPreview ←── 正则解析
```

## 包大小参考

| 库 | 大小（gzip） | 用途重要度 |
|---|------------|-----------|
| pdfjs-dist | ~800KB | PDF 必需 |
| exceljs | ~400KB | Excel 必需 |
| shiki/core + JS engine | ~25KB (首屏 0KB，懒加载) | 代码高亮（按需） |
| @shikijs/langs/* | 4-20KB/语言 (懒加载) | 语法定义（按需） |
| docx-preview | ~74KB | DOCX 高保真渲染 |
| mammoth | ~100KB | DOC 旧格式文本提取 |
| jszip | ~50KB | ZIP/EPUB/PPTX 必需 |
| react-markdown | ~30KB | Markdown 必需 |
