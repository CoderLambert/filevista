# FileVista Stage 18.2 实现文档：Preview Error Boundary & Plugin Fallback

## 1. 阶段定位

Stage 18.0 完成 Source-first 数据模型清理，Stage 18.1 完成大文件策略与远程加载控制。

Stage 18.2 专注于**预览失败后的稳定降级**：

当前 `PluginPreviewRenderer` 已经是唯一公开入口，内部通过 `React.lazy(plugin.load)` 动态加载插件，并用 `Suspense` 显示 loading；没有插件时会进入 `UnsupportedPluginPreview` fallback。现在能处理"没有插件"的情况，但还没有系统处理"插件加载失败 / 插件渲染崩溃 / Adapter 读取失败"这些运行时异常。

## 2. 阶段目标

核心目标：

```txt
任何插件加载失败、预览渲染崩溃、source 读取失败，都不能让整个页面崩溃。
```

最终体验：

```txt
1. 插件加载失败 → 显示统一 fallback，可 Retry，可 Download
2. 插件渲染崩溃 → 显示统一 fallback，可 Retry，可 Download
3. Adapter 读取 source 失败 → 显示统一 fallback，可 Retry，可 Download
4. unsupported / degraded / legacy office → 继续走统一 fallback
5. 错误详情默认折叠，仅开发环境或用户展开时显示
6. 单个文件预览失败不影响文件列表、Header、远程 URL 输入、其他文件预览
```

## 3. 本阶段不做

```txt
不做 Worker 化
不做大文本虚拟滚动
不做 CSV 虚拟表格
不新增文件类型
不做后端转换
不做远程代理
不做 PDF / Office 渲染中途取消
不做错误上报服务
```

## 4. 推荐提交拆分

```txt
18.2.1 feat: add unified preview fallback
18.2.2 feat: add preview error boundary
18.2.3 refactor: wrap plugin renderer with error boundary
18.2.4 refactor: unify unsupported preview fallback
18.2.5 chore: extract PreviewLoading as public component
18.2.6 chore: remove duplicated large file hint from plugin renderer
```

## 5. 18.2.1：新增统一 PreviewFallback

新增文件：

```txt
src/components/file-preview/PreviewFallback.tsx
```

类型：

```ts
export type PreviewFallbackKind =
  | "unsupported"
  | "plugin-load-failed"
  | "render-failed"
  | "source-read-failed"
  | "file-too-large"
  | "aborted"
  | "unknown";
```

Props：

```ts
interface PreviewFallbackProps {
  kind: PreviewFallbackKind;
  file: FileInfo;
  title?: string;
  description?: string;
  error?: unknown;
  pluginId?: string;
  pluginName?: string;
  onRetry?: () => void;
  canDownload?: boolean;
}
```

核心能力：

```txt
1. 统一标题 — 按 kind 返回默认标题
2. 友好描述 — 按 kind 返回默认描述
3. Retry 按钮 — onRetry 存在时显示
4. Download original 按钮 — canDownload 存在时显示
5. 错误详情折叠 — 仅在有 error 时显示
6. 复制错误详情 — 开发环境显示复制按钮
7. 开发环境默认显示 pluginId / pluginName
```

## 6. 18.2.2：新增 PreviewErrorBoundary

新增文件：

```txt
src/components/file-preview/PreviewErrorBoundary.tsx
```

Error Boundary 必须用 class component：

```tsx
export class PreviewErrorBoundary extends React.Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  // getDerivedStateFromError — 捕获 render 错误
  // getDerivedStateFromProps — resetKey 变化时重置错误状态
  // componentDidCatch — 开发环境 console.warn 错误详情
  // render — 有错误时显示 PreviewFallback(kind="render-failed")
}
```

关键设计：

```txt
resetKey 变化时自动重置 error state（切换文件时自动清除前一个文件的错误）
onRetry 传递给 PreviewFallback 作为重试按钮
```

## 7. 18.2.3：PluginPreviewRenderer 接入 ErrorBoundary

修改文件：

```txt
src/components/file-preview/PluginPreviewRenderer.tsx
```

### 新增 retryKey

```ts
const [retryKey, setRetryKey] = useState(0);
```

### 创建 lazy component 时包 catch

```ts
class PreviewPluginLoadError extends Error {
  constructor(
    public pluginId: string,
    public pluginName: string,
    public cause: unknown,
  ) {
    super(`Failed to load preview plugin: ${pluginName}`);
    this.name = "PreviewPluginLoadError";
  }
}

const component = lazy(() =>
  plugin.load().catch((error) => {
    throw new PreviewPluginLoadError(plugin.id, plugin.name, error);
  }),
);
```

### Retry 清理缓存

```ts
const handleRetry = useCallback(() => {
  if (plugin) {
    componentCache.current.delete(plugin);
  }

  setRetryKey((value) => value + 1);
}, [plugin]);
```

### 包 ErrorBoundary

```tsx
<PreviewErrorBoundary
  file={file}
  pluginId={plugin.id}
  pluginName={plugin.name}
  resetKey={`${file.id}:${plugin.id}:${retryKey}`}
  onRetry={handleRetry}
>
  <Suspense fallback={<PreviewLoading />}>
    <PreviewComponent file={file} />
  </Suspense>
</PreviewErrorBoundary>
```

这样：

```txt
plugin import 失败 → ErrorBoundary fallback → PreviewFallback(kind="plugin-load-failed")
preview render 崩溃 → ErrorBoundary fallback → PreviewFallback(kind="render-failed")
点击 Retry → 清空 cache → 重新 lazy import / render
```

## 8. 18.2.4：UnsupportedPluginPreview 统一到 PreviewFallback

修改文件：

```txt
src/components/file-preview/preview-adapters/UnsupportedPluginPreview.tsx
```

Props 改为接收 `FileInfo`：

```ts
interface UnsupportedPluginPreviewProps {
  file: FileInfo;
  title?: string;
  description?: string;
}
```

内部改为调用 `PreviewFallback`：

```tsx
export function UnsupportedPluginPreview({
  file,
  title,
  description,
}: UnsupportedPluginPreviewProps) {
  const legacyMime = LEGACY_OFFICE_MIME_TYPES[file.fileType];
  const isLegacy = Boolean(legacyMime);

  return (
    <PreviewFallback
      kind="unsupported"
      file={file}
      title={title ?? UNSUPPORTED_TITLES[file.fileType] ?? "Preview Not Available"}
      description={description ?? UNSUPPORTED_DESCRIPTIONS[file.fileType] ?? `...`}
      canDownload
    />
  );
}
```

同步修改 `PluginPreviewRenderer` 调用点：

```tsx
<UnsupportedPluginPreview
  file={file}
  title={support.status === "legacy-only" ? "Not Migrated Yet" : undefined}
  description={...}
/>
```

测试同步更新。

## 9. 18.2.5：提取 PreviewLoading 为公共组件

新增文件：

```txt
src/components/file-preview/PreviewLoading.tsx
```

```tsx
export function PreviewLoading({
  label = "Loading preview...",
}: PreviewLoadingProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
```

原 `PluginPreviewRenderer` 内部的私有 `PreviewLoading` 函数被移除，改为引用公共组件。

## 10. 18.2.6：移除 PluginPreviewRenderer 内的 LargeFileHint

Stage 18.1 已经有 `LargeFileGate` 负责 warning / confirm / block，而且它会在真正进入 Plugin Renderer 前拦截。

所以移除：

```tsx
<LargeFileHint file={file} />
```

原因：

```txt
1. 避免 warning 重复出现
2. 大文件策略统一由 LargeFileGate 管理
3. PluginPreviewRenderer 只负责插件加载和错误边界
```

## 11. 完成后的架构

```txt
page.tsx
  └─ LargeFileGate
      └─ PluginPreviewRenderer
          ├─ resolve plugin
          ├─ no plugin → UnsupportedPluginPreview → PreviewFallback(kind="unsupported")
          └─ plugin exists
              └─ PreviewErrorBoundary
                  ├─ on error → PreviewFallback(kind="render-failed"|"plugin-load-failed")
                  └─ on success
                      └─ Suspense
                          └─ PreviewLoading
                          └─ PreviewComponent
```

异常流：

```txt
没有插件
→ UnsupportedPluginPreview
→ PreviewFallback(kind="unsupported")

plugin.load 失败
→ PreviewPluginLoadError
→ PreviewErrorBoundary catches
→ PreviewFallback(kind="plugin-load-failed")

PreviewComponent render 抛错
→ PreviewErrorBoundary catches
→ PreviewFallback(kind="render-failed")

Adapter readSource 失败
→ Adapter state error
→ 各 Adapter 内显示 PreviewFallback(kind="source-read-failed")
（后续 Stage 继续迁移 Adapter）
```

## 12. 测试

更新：

```txt
src/components/file-preview/preview-adapters/__tests__/UnsupportedPluginPreview.test.tsx
```

测试覆盖：

```txt
1. 默认 unknown 不支持状态
2. 中文标题和描述（doc/ppt/xls）
3. 下载按钮存在
4. 自定义 title/description
5. 下载触发 downloadSource
```

建议后续补充：

```txt
src/components/file-preview/__tests__/PreviewErrorBoundary.test.tsx
src/components/file-preview/__tests__/PreviewFallback.test.tsx
```

## 13. 验收标准

Stage 18.2 完成后应满足：

```txt
1. PluginPreviewRenderer 被 PreviewErrorBoundary 包裹
2. plugin.load reject 不会导致整页崩溃
3. PreviewComponent render throw 不会导致整页崩溃
4. fallback 中有 Retry
5. fallback 中有 Download original
6. unsupported / degraded / legacy-only 统一使用 PreviewFallback
7. 切换文件后错误状态自动重置（resetKey 机制）
8. 点击 Retry 可以重新加载插件
9. LargeFileHint 不再和 LargeFileGate 重复
10. PreviewLoading 抽成公共组件
11. bun run check 通过
12. bun run build:pages 通过
13. vitest 全部通过
```

## 14. 后续阶段

```txt
Stage 18.3：Worker 化重任务
Stage 18.4：大文本 / CSV / 代码虚拟化
Stage 19：库化与 NPM 发布准备
```

Adapter 迁移（建议在 18.2 后续或 18.3 中进行）：

```txt
各 Adapter 组件内 useSourceText / useSourceBase64 等 hook 读取失败后
统一显示 PreviewFallback(kind="source-read-failed") 而非各写一套错误 UI
```
