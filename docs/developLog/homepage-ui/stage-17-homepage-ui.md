# Stage 17 Homepage UI — 开发日志

## 概述

首页（`src/app/page.tsx`）仅做轻量发布态增强，不改动上传/预览核心逻辑。

## 涉及提交

| Commit | 说明 |
|---|---|
| `9f69e3c` | 主改动：Header 入口 + 文案增强 + 支持格式修正 |
| `735227e` | 间接影响：demos.ts 文案同步修正 |
| `b12f8c0` | 修正：删除 useEffect 自动加载远程 URL，改为预填默认值 |

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

### 5. 删除自动加载远程 URL 逻辑

问题：

```tsx
// 原来：打开页面自动请求第三方 URL
useEffect(() => {
  if (files.length === 0) {
    setRemoteUrl(DEFAULT_REMOTE_URL);
    loadRemoteUrl();
  }
}, []);
```

这导致：
1. 首次打开页面触发"Remote URL is empty" toast（setRemoteUrl 是异步的，loadRemoteUrl 立即读取空值）
2. 自动请求第三方 URL 不适合作为公开 Demo 的默认行为
3. `useEffect` 依赖 `loadRemoteUrl`（引用 `remoteUrl`），但 deps 是 `[]`，属于 stale closure

修复：

```tsx
// 删除 useEffect + setRemoteUrl 分离调用
// 改为初始值直接预填
const [remoteUrl, setRemoteUrl] = useState(DEFAULT_REMOTE_URL);
```

效果：
```
打开页面 → 输入框预填示例 URL → 用户主动点击 "URL" 按钮才发起请求
```

## 未改动

以下核心逻辑均未触碰：
- `processFile` — 文件读取处理
- `addFiles` — 文件添加逻辑
- `loadDemoFiles` — Demo 文件加载
- `previewEngine` — 预览引擎切换
- `TabCacheRenderer` — Legacy 渲染器
- `PluginPreviewRenderer` — Plugin 渲染器
