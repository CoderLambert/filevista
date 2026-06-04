# Stage 17 Homepage UI — 开发日志

## 概述

首页（`src/app/page.tsx`）仅做轻量发布态增强，不改动上传/预览核心逻辑。

## 涉及提交

| Commit | 说明 |
|---|---|
| `9f69e3c` | 主改动：Header 入口 + 文案增强 + 支持格式修正 |
| `735227e` | 间接影响：demos.ts 文案同步修正 |

## 改动内容

### 1. Header 新增导航链接

在 Header 右侧新增三个外部链接按钮：

```tsx
// GitHub
href="https://github.com/CoderLambert/filevista"

// Docs
href="https://github.com/CoderLambert/filevista/tree/main/docs"

// Support
href="https://github.com/CoderLambert/filevista/blob/main/docs/user-facing-preview-support.md"
```

图标：`Github`、`BookOpen`、`Eye`（复用已有）。在窄屏下隐藏文字，只保留图标。

### 2. 标题副标题文案

原来：
```txt
纯浏览器端文件预览
```

改为：
```txt
纯浏览器端文件预览 · 文件不上传
```

### 3. 空状态新增英文文案

在中文描述下方补充：
```txt
Pure browser-side file preview. No upload. No server processing.
```

### 4. 支持格式 badge 文案修正

原来：
```txt
DOC, DOCX, PPT, Excel, ...
```

改为：
```txt
DOCX, PPTX, XLSX, DOC limited, ...
```

去掉了 `DOC`/`PPT`/`Excel` 这些可能造成误解的标签。

## 未改动

以下核心逻辑均未触碰：
- `processFile` — 文件读取处理
- `addFiles` — 文件添加逻辑
- `loadDemoFiles` — Demo 文件加载
- `previewEngine` — 预览引擎切换
- `TabCacheRenderer` — Legacy 渲染器
- `PluginPreviewRenderer` — Plugin 渲染器
