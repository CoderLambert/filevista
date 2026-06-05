# feat: add preview error boundary and fallback (Stage 18.2)

## 改动背景

Stage 18.0/18.1 完成后，插件加载和远程文件体验已有基础保障，但还没有系统处理"插件加载失败 / 插件渲染崩溃 / Adapter 读取失败"这些运行时异常。任何一处失败都会导致页面崩溃或红屏。

## 改动方案

### 1. PreviewFallback 统一 fallback 组件
- 7 种 fallback kind（unsupported / plugin-load-failed / render-failed / source-read-failed / file-too-large / aborted / unknown）
- 按 kind 自动返回默认标题和描述
- Retry 按钮 + Download original 按钮
- 错误详情折叠展示，开发环境默认展开 + 复制按钮

### 2. PreviewErrorBoundary class component
- getDerivedStateFromError 捕获 render 错误
- getDerivedStateFromProps 通过 resetKey 实现切换文件时自动重置
- componentDidCatch 开发环境 console.warn 错误详情
- 有错误时渲染 PreviewFallback(kind="render-failed")

### 3. PluginPreviewRenderer 接入
- lazy plugin.load 时用 .catch 包装为 PreviewPluginLoadError
- retryKey + handleRetry：点击 Retry 时清理 cache 并重新 lazy import
- ErrorBoundary 包裹 Suspense + PreviewComponent
- resetKey 使用 `${file.id}:${plugin.id}:${retryKey}` 确保任何变化都能重置

### 4. UnsupportedPluginPreview 统一
- Props 从 `{fileType, fileName, content, source, title, description}` 简化为 `{file, title, description}`
- 内部调用 PreviewFallback，不再自己写一套错误 UI
- 自动支持 Download original（通过 FileInfo.source）

### 5. PreviewLoading 公共化
- 从 PluginPreviewRenderer 内部提取为独立组件
- 支持自定义 label

### 6. 移除重复的 LargeFileHint
- 从 PluginPreviewRenderer 内部移除
- Stage 18.1 的 LargeFileGate 已经在外部处理

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `PreviewFallback.tsx` | 新增 | 统一 fallback 组件 |
| `PreviewErrorBoundary.tsx` | 新增 | class component 错误边界 |
| `PreviewLoading.tsx` | 新增 | 公共 loading 组件 |
| `PluginPreviewRenderer.tsx` | 修改 | 接入 ErrorBoundary + retry + 移除 LargeFileHint |
| `UnsupportedPluginPreview.tsx` | 修改 | 改用 FileInfo + PreviewFallback |
| `UnsupportedPluginPreview.test.tsx` | 修改 | 测试适配新 API |

## 验证结果

```
✓ bun run build:pages — 通过（Compiled successfully）
✓ bun run lint — 通过（0 errors）
✓ vitest run file-preview/ — 46 pass, 0 fail
```
