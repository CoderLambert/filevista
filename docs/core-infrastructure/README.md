# 核心基础设施

## 框架架构

### Next.js App Router

```
src/app/
├── layout.tsx    # 根布局（字体、Toaster、HTML 元数据）
├── page.tsx      # 唯一页面（文件管理 + 预览入口）
├── globals.css   # 全局样式 + CSS 变量
└── api/route.ts  # API 路由（预留，当前未使用）
```

- **单页应用**：仅 `/` 路由，所有功能在客户端完成
- **Client Component**：`page.tsx` 标记 `"use client"`
- **无 SSR 数据获取**：所有文件处理在浏览器端完成

### 页面组件结构 (page.tsx)

```
page.tsx (~520 行)
│
├── 状态管理
│   ├── files: FileInfo[]          # 文件列表
│   ├── activeFileId: string       # 当前活跃文件 ID
│   ├── isDragOver: boolean        # 拖拽状态
│   └── loadingDemo: boolean       # Demo 加载状态
│
├── 文件处理
│   ├── processFile(file)          # 读取文件 → FileInfo
│   ├── addFiles(fileList)         # 批量添加文件
│   ├── removeFile(id)            # 删除文件
│   ├── loadDemoFiles()           # 异步加载 Demo 文件
│   └── clearAllFiles()           # 清空所有文件
│
├── 拖拽处理
│   ├── handleDragOver()
│   ├── handleDragLeave()
│   └── handleDrop()
│
└── UI 布局
    ├── Header（Logo + Demo 按钮 + 清空按钮）
    ├── Sidebar（文件列表 + 上传按钮）
    ├── Main Area（文件信息栏 + 预览区）
    └── Footer（文件数量统计）
```

## 文件处理流水线

### 二进制 vs 文本判断

```typescript
const isBinary = ["pdf", "docx", "doc", "pptx", "xlsx", "zip", "epub", "image", "video", "audio"]
  .includes(fileType);
```

### 读取方式

| 文件类型 | 读取方式 | 数据格式 | 传递方式 |
|---------|---------|---------|---------|
| PDF, DOCX, DOC, PPTX, XLSX, ZIP, EPUB | `FileReader.readAsDataURL()` | base64 string | `content` 字段 |
| Image, Video, Audio | `URL.createObjectURL()` | Object URL | `url` 字段 |
| Markdown, JSON, Code, CSV, Text, HTML, SVG, RTF | `FileReader.readAsText()` | text string | `content` 字段 |

### 类型检测优先级

```
1. 文件扩展名匹配（最可靠）
2. MIME 类型匹配（辅助判断）
3. 特殊文件名（Dockerfile, Makefile 等）
4. 降级为 "unknown"
```

## 工具函数 (utils.ts)

### FileInfo 接口

```typescript
interface FileInfo {
  id: string;           // 唯一标识符 (Math.random + Date.now)
  name: string;         // 文件名
  size: number;         // 文件大小 (bytes)
  type: string;         // MIME 类型
  fileType: FileType;   // 检测到的文件类型枚举
  content: string | null;  // base64(二进制) 或 text(文本)
  url: string | null;      // Object URL (媒体文件)
}
```

### FileType 联合类型

```typescript
type FileType = "pdf" | "markdown" | "json" | "code" | "docx" | "doc"
  | "pptx" | "xlsx" | "html" | "zip" | "svg" | "rtf" | "epub"
  | "image" | "text" | "csv" | "video" | "audio" | "unknown";
```

## Demo 文件系统 (demos.ts)

### 架构

```
demos.ts
│
├── DEMO_FILES (Record)          # 文本 Demo（内联内容）
│   ├── readme.md                # Markdown
│   ├── package.json             # JSON
│   ├── example.ts               # TypeScript
│   ├── data.csv                 # CSV
│   └── config.env               # Text
│
├── DEMO_BINARY_FILES (Record)   # 二进制 Demo（URL 引用）
│   ├── epub                     # 精通Python爬虫框架Scrapy.epub
│   ├── xlsx                     # test_features.xlsx
│   └── docx                     # demo.docx
│
└── fetchBinaryDemoFiles()       # 异步获取二进制 Demo
    └── fetch(url) → blob → base64
```

### 加载流程
1. `loadDemoFiles()` 被调用
2. 同步创建 5 个文本 Demo 的 FileInfo
3. 异步 `fetchBinaryDemoFiles()` 从 `public/demo/` 获取 3 个二进制文件
4. 合并所有 Demo，设置到文件列表

## 样式系统

### CSS 变量主题

```css
:root {
  --background, --foreground
  --card, --card-foreground
  --primary, --primary-foreground
  --muted, --muted-foreground
  --accent, --accent-foreground
  --destructive, --destructive-foreground
  --border, --input, --ring
}
```

### 暗色模式
- Tailwind `darkMode: "class"` 策略
- `next-themes` 库支持主题切换
- CSS 变量 `.dark` 选择器覆盖

## 数据库 (Prisma)

### Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

> 注：数据库当前未在文件预览功能中使用，为预留基础设施。

## 内存管理

### Object URL 生命周期

```
创建：URL.createObjectURL(file) → url
使用：<img/video/audio src={url} />
释放：URL.revokeObjectURL(url)
  ├── removeFile() 时释放
  └── clearAllFiles() 时释放所有
```

### EPUB 图片 Blob URL

```
创建：parseEpub() 中为每张图片创建 Blob URL
使用：章节 HTML 中 <img src="blob:..." />
释放：组件卸载时 useEffect cleanup 释放所有
```
