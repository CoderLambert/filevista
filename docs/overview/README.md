# FileVista — 项目概述

## 项目简介

FileVista 是一个纯浏览器端文件预览工具集，支持本地 File、Blob、ArrayBuffer 和远程 URL，面向 React、Vue、Svelte 等主流前端框架提供统一预览能力。支持 18 种文件类型的即时预览，涵盖文档、代码、数据、媒体等常见格式。

## 核心特性

### 🌐 纯浏览器处理
- 所有文件解析在客户端完成，零服务端依赖
- 文件不离开用户设备，确保隐私安全
- 基于 FileReader API 读取本地文件

### 📁 18 种文件格式支持

| 分类 | 支持格式 | 预览特性 |
|------|---------|---------|
| 文档 | PDF, DOCX, DOC, EPUB, RTF | 页面渲染、章节导航、样式还原 |
| 演示 | PPTX, PPT | 幻灯片导航、缩略图、备注 |
| 电子表格 | XLSX, XLS, CSV | 单元格样式、合并单元格、图片、虚拟滚动、搜索 |
| 代码 | JS/TS/PY/RS 等 30+ 语言 | 语法高亮、行号、自动语言检测 |
| 标记语言 | Markdown, HTML, SVG | GFM 渲染、实时预览、矢量图缩放 |
| 数据 | JSON, CSV | 格式化、语法高亮、排序、筛选 |
| 媒体 | 图片(PNG/JPG/GIF/WebP)、视频(MP4/WebM)、音频(MP3/WAV) | 缩放旋转、原生播放器 |
| 归档 | ZIP | 文件列表、目录树、大小统计 |

### 🎨 现代化 UI/UX
- 响应式设计，移动端友好
- 亮色/暗色主题切换
- 拖拽上传 + 文件选择器
- 文件列表侧边栏 + 预览区域双栏布局
- 加载状态、错误处理、空状态引导

### 📦 Demo 文件系统
- 5 个内置文本 demo（Markdown, JSON, TypeScript, CSV, ENV）
- 3 个二进制 demo（EPUB 电子书, XLSX 表格, DOCX 文档）
- 一键加载所有 demo 文件

## 技术架构概览

```
┌─────────────────────────────────────────────────┐
│                    用户界面层                      │
│  page.tsx (文件管理) + FilePreviewRenderer (路由)  │
└──────────────────────┬──────────────────────────┘
                       │ switch(fileType)
┌──────────────────────┼──────────────────────────┐
│                 预览组件层 (17 个)                  │
│  PdfPreview │ MarkdownPreview │ CodePreview      │
│  DocxPreview │ PptxPreview │ XlsxPreview         │
│  EpubPreview │ ImagePreview │ CsvPreview         │
│  ...更多组件                                      │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│                 工具与解析层                        │
│  utils.ts (类型检测) │ demos.ts (Demo 数据)       │
│  exceljs │ mammoth │ jszip │ pdfjs-dist          │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│                 框架与基础设施层                     │
│  Next.js 16 │ React 19 │ TypeScript 5            │
│  Tailwind CSS 4 │ shadcn/ui │ Zustand            │
└─────────────────────────────────────────────────┘
```

## 数据流

```
用户选择文件
    │
    ▼
FileReader API 读取
    │
    ├── 文本文件 → readAsText → content (string)
    │
    └── 二进制文件 → readAsDataURL → content (base64 string)
                   → readAsArrayBuffer → url (Object URL)
    │
    ▼
detectFileType(filename, mimeType) → FileType
    │
    ▼
FileInfo { id, name, size, type, fileType, content, url }
    │
    ▼
FilePreviewRenderer → switch(fileType) → 对应 Preview 组件
    │
    ▼
预览渲染
```

## 项目定位

- **单页应用**：仅 `/` 路由，所有功能在一个页面内完成
- **纯前端**：无后端 API 依赖（预留 API route 但未使用）
- **工具型应用**：面向需要快速预览各类文件的用户
- **隐私优先**：本地处理，文件不上传

## 项目目标

1. 提供全格式的文件预览能力
2. 尽可能还原文件原始样式和布局
3. 保持流畅的交互体验（虚拟滚动、懒加载）
4. 支持大文件预览（Excel 虚拟滚动、PDF 分页）
5. 良好的中文支持（EPUB 中文目录、中文文件名）
