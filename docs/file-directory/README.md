# 项目文件目录结构

## 顶层目录

```
/home/z/my-project/
├── src/                    # 源代码（核心开发目录）
├── public/                 # 静态资源（直接通过 URL 访问）
├── prisma/                 # 数据库 Schema 定义
├── db/                     # SQLite 数据库文件
├── upload/                 # 用户上传的文件（临时存储）
├── skills/                 # AI Skills 能力模块（SDK 参考）
├── examples/               # 示例代码（WebSocket 等）
├── mini-services/          # 微服务目录（独立进程）
├── .zscripts/              # 开发脚本（启动、构建等）
└── docs/                   # 项目文档
```

## 源代码结构 `src/`

```
src/
├── app/                           # Next.js App Router
│   ├── api/
│   │   └── route.ts               # API 路由（预留，未使用）
│   ├── globals.css                # 全局样式 + CSS 变量定义
│   ├── layout.tsx                 # 根布局（字体、Toaster、元数据）
│   └── page.tsx                   # 主页面（文件管理 + 预览入口）
│
├── components/
│   ├── file-preview/              # 文件预览组件（核心业务）
│   │   ├── FilePreviewRenderer.tsx # 预览路由分发器
│   │   ├── utils.ts               # 工具函数（类型检测、格式化等）
│   │   ├── demos.ts               # Demo 文件数据 + 异步加载
│   │   │
│   │   │── 文档预览
│   │   ├── PdfPreview.tsx         # PDF 预览（pdfjs-dist）
│   │   ├── DocxPreview.tsx        # DOCX 预览（mammoth.js）
│   │   ├── DocPreview.tsx         # DOC 预览（ mammoth.js + base64）
│   │   ├── EpubPreview.tsx        # EPUB 预览（jszip + 手动解析）
│   │   ├── RtfPreview.tsx         # RTF 预览（正则提取文本）
│   │   │
│   │   │── 演示文稿预览
│   │   ├── PptxPreview.tsx        # PPTX/PPT 预览（jszip 解析）
│   │   │
│   │   │── 电子表格预览
│   │   ├── XlsxPreview.tsx        # XLSX 预览（exceljs，虚拟滚动）
│   │   ├── CsvPreview.tsx         # CSV 预览（排序、搜索表格）
│   │   │
│   │   │── 代码与标记语言预览
│   │   ├── CodePreview.tsx        # 代码预览（react-syntax-highlighter）
│   │   ├── MarkdownPreview.tsx    # Markdown 预览（react-markdown + remark-gfm）
│   │   ├── HtmlPreview.tsx        # HTML 预览（iframe sandbox）
│   │   ├── SvgPreview.tsx         # SVG 预览（缩放控制）
│   │   │
│   │   │── 数据预览
│   │   ├── JsonPreview.tsx        # (合并到 CodePreview isJson=true)
│   │   │
│   │   │── 媒体预览
│   │   ├── ImagePreview.tsx       # 图片预览（缩放、旋转、重置）
│   │   ├── VideoPreview.tsx       # 视频预览（原生 HTML5 player）
│   │   ├── AudioPreview.tsx       # 音频预览（原生 HTML5 player）
│   │   │
│   │   │── 归档预览
│   │   ├── ZipPreview.tsx         # ZIP 预览（jszip 文件列表）
│   │   │
│   │   │── 文本预览
│   │   └── TextPreview.tsx        # 纯文本预览（行号、换行）
│   │
│   └── ui/                        # shadcn/ui 组件库（48 个组件）
│       ├── accordion.tsx
│       ├── alert.tsx
│       ├── badge.tsx              # ✅ 使用中（文件类型标签）
│       ├── button.tsx             # ✅ 使用中（全局按钮）
│       ├── dialog.tsx
│       ├── input.tsx              # ✅ 使用中（搜索输入）
│       ├── scroll-area.tsx        # ✅ 使用中（文件列表滚动）
│       ├── separator.tsx          # ✅ 使用中（UI 分隔线）
│       ├── slider.tsx             # ✅ 使用中（图片/图片缩放）
│       ├── sonner.tsx             # ✅ 使用中（Toast 通知）
│       ├── tabs.tsx               # ✅ 使用中（移动端文件导航）
│       ├── tooltip.tsx
│       └── ... (36 个未使用但可用的 shadcn 组件)
│
├── hooks/
│   ├── use-mobile.ts              # 移动端检测 hook
│   └── use-toast.ts               # Toast 通知 hook
│
└── lib/
    ├── db.ts                      # Prisma 客户端单例
    └── utils.ts                   # cn() 工具函数 (clsx + tailwind-merge)
```

## 静态资源 `public/`

```
public/
├── demo/                          # Demo 文件目录
│   ├── demo.docx                  # Word 文档 demo（13KB）
│   ├── test_features.xlsx         # Excel 表格 demo（8.6KB）
│   └── 精通Python爬虫框架Scrapy.epub  # EPUB 电子书 demo（5MB）
├── logo.svg                       # 项目 Logo
└── robots.txt                     # 搜索引擎配置
```

## 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖管理、脚本定义 |
| `tsconfig.json` | TypeScript 编译配置 |
| `next.config.ts` | Next.js 框架配置 |
| `tailwind.config.ts` | Tailwind CSS 配置 |
| `postcss.config.mjs` | PostCSS 配置 |
| `eslint.config.mjs` | ESLint 代码检查配置 |
| `components.json` | shadcn/ui 组件配置 |
| `prisma/schema.prisma` | Prisma 数据库 Schema |
| `.env` | 环境变量（DATABASE_URL 等） |
| `Caddyfile` | Caddy 网关配置 |

## 文件大小参考

| 模块 | 文件数 | 关键文件大小 |
|------|-------|------------|
| `file-preview/` | 22 | XlsxPreview ~700 行, EpubPreview ~550 行, PptxPreview ~400 行 |
| `page.tsx` | 1 | ~520 行 |
| `ui/` | 48 | shadcn 标准组件 |
| `public/demo/` | 3 | EPUB 5MB, XLSX 8.6KB, DOCX 13KB |
