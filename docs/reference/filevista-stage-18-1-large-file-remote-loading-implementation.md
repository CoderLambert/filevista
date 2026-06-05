# FileVista Stage 18.1 实现文档：大文件策略与远程加载控制

## 1. 阶段定位

Stage 18.0 已经完成 Source-first 架构清理：

- Plugin Renderer 成为唯一公开入口
- FileInfo.source 必填
- content / url 降级为 deprecated 可选字段
- 本地上传不再提前预读
- 远程 URL 不再提前生成 base64
- Adapter 按需从 source 读取
- Unsupported fallback 支持 source 下载

Stage 18.1 继续处理“文件加载体验”：

- 大文件策略
- 本地文件预览前提示 / 确认 / 阻止
- 远程 URL fetch 取消
- 远程 URL 下载进度
- Content-Length 不可读时的降级显示
- CORS / 网络失败时的兜底体验

本阶段不做 Worker 化、不做完整 ErrorBoundary、不做大文本虚拟滚动。

---

## 2. 阶段目标

Stage 18.1 的目标是让用户在处理大文件和远程文件时获得可预期、可取消、有反馈的体验。

目标清单：

1. 建立统一文件大小策略。
2. 本地文件加入后不立即读取内容。
3. 用户真正预览大文件前显示 warning / confirm / block。
4. 远程 URL fetch 支持 AbortController。
5. 远程 URL fetch 支持下载进度。
6. Content-Length 可读时显示百分比。
7. Content-Length 不可读时显示已下载大小。
8. 用户可以取消远程 URL 加载。
9. 取消后不报错、不红屏。
10. CORS / 网络错误继续保留 Open 原链接兜底。
11. 不回退到 content/base64 主链路。

---

## 3. 本阶段不做

- 不实现 Worker 化。
- 不实现 PDF / Office 渲染取消。
- 不做大文本虚拟滚动。
- 不做 CSV 虚拟表格。
- 不做完整 PreviewErrorBoundary。
- 不新增文件类型。
- 不实现旧版 .ppt / .xls 预览。
- 不引入后端代理。
- 不绕过 CORS。
- 不把 HEAD 请求作为主流程。

---

## 4. 推荐提交拆分

建议拆成 6 个小提交：

```txt
18.1.1 feat: add preview size policy
18.1.2 feat: gate large file previews
18.1.3 refactor: support abort signal in source readers
18.1.4 feat: add remote URL loading progress
18.1.5 feat: add cancel control for remote URL loading
18.1.6 docs: document large file and remote loading policy
```

---

## 5. 18.1.1：统一大文件策略

新增文件：

```txt
src/components/file-preview/performance-limits.ts
```

参考实现：

```ts
import type { FileType } from "./utils";

export const PREVIEW_SIZE_LIMITS = {
  warning: 20 * 1024 * 1024,
  confirm: 50 * 1024 * 1024,
  block: 100 * 1024 * 1024,
} as const;

export type PreviewSizeLevel = "normal" | "warning" | "confirm" | "block";

export interface PreviewSizePolicy {
  level: PreviewSizeLevel;
  shouldWarn: boolean;
  shouldConfirm: boolean;
  shouldBlock: boolean;
  message: string | null;
}

export function getPreviewSizeLevel(size: number): PreviewSizeLevel {
  if (size >= PREVIEW_SIZE_LIMITS.block) return "block";
  if (size >= PREVIEW_SIZE_LIMITS.confirm) return "confirm";
  if (size >= PREVIEW_SIZE_LIMITS.warning) return "warning";
  return "normal";
}

export function getPreviewSizePolicy(input: {
  size: number;
  fileType?: FileType;
}): PreviewSizePolicy {
  const level = getPreviewSizeLevel(input.size);

  if (level === "block") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: true,
      message:
        "This file is very large and may freeze the browser. Browser-side preview is disabled by default.",
    };
  }

  if (level === "confirm") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: true,
      shouldBlock: false,
      message:
        "This file is large and may take time to preview. Continue only if you trust the file and your browser has enough memory.",
    };
  }

  if (level === "warning") {
    return {
      level,
      shouldWarn: true,
      shouldConfirm: false,
      shouldBlock: false,
      message:
        "This file is relatively large. Preview may be slower depending on your browser and device.",
    };
  }

  return {
    level,
    shouldWarn: false,
    shouldConfirm: false,
    shouldBlock: false,
    message: null,
  };
}
```

默认阈值：

| 级别 | 大小 | 行为 |
|---|---:|---|
| normal | `< 20MB` | 正常预览 |
| warning | `20MB - 50MB` | 显示提示，不阻止 |
| confirm | `50MB - 100MB` | 需要用户确认 |
| block | `>= 100MB` | 默认阻止预览，提供下载 |

后续可以按文件类型细化阈值，例如 PDF、XLSX、PPTX、ZIP 使用不同策略。

---

## 6. 18.1.2：本地文件大文件 Gate

Stage 18.1 不建议在“选择文件时”阻止文件进入列表。更好的体验是：

```txt
文件选择后仍进入列表
用户点击预览时再根据 size policy 显示 warning / confirm / block
```

这样符合 Stage 18.0 的 source-first 策略：文件进入列表时不预读，真正预览时才读取。

新增组件：

```txt
src/components/file-preview/LargeFileGate.tsx
```

参考实现：

```tsx
"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileInfo } from "./utils";
import { formatFileSize } from "./utils";
import { getPreviewSizePolicy } from "./performance-limits";
import { downloadSource } from "./core/download";

interface LargeFileGateProps {
  file: FileInfo;
  confirmed: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}

export function LargeFileGate({
  file,
  confirmed,
  onConfirm,
  children,
}: LargeFileGateProps) {
  const policy = getPreviewSizePolicy({
    size: file.size,
    fileType: file.fileType,
  });

  if (!policy.shouldWarn) {
    return <>{children}</>;
  }

  if (policy.level === "warning") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              Large file: {formatFileSize(file.size)}. Preview may be slower.
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  }

  if (policy.shouldConfirm && !confirmed) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Large file preview</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {policy.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm}>Preview anyway</Button>
          <Button
            variant="outline"
            onClick={() => downloadSource(file.source, file.name, file.type)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  if (policy.shouldBlock) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">File too large to preview</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {policy.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadSource(file.source, file.name, file.type)}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Download original file
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
```

在 `page.tsx` 中新增状态：

```ts
const [previewConfirmedFileIds, setPreviewConfirmedFileIds] = useState<Set<string>>(
  () => new Set()
);
```

接入方式：

```tsx
{activeFile ? (
  <LargeFileGate
    file={activeFile}
    confirmed={previewConfirmedFileIds.has(activeFile.id)}
    onConfirm={() => {
      setPreviewConfirmedFileIds((prev) => {
        const next = new Set(prev);
        next.add(activeFile.id);
        return next;
      });
    }}
  >
    <PluginPreviewRenderer
      file={activeFile}
      showPluginDebug={process.env.NODE_ENV === "development"}
    />
  </LargeFileGate>
) : (
  <EmptyState />
)}
```

关键点：

```txt
LargeFileGate 必须包在 PluginPreviewRenderer 外层。
这样用户确认前，Adapter 不会开始读取大文件。
```

---

## 7. 18.1.3：source reader 支持 AbortSignal

修改文件：

```txt
src/components/file-preview/core/source.ts
```

新增：

```ts
export interface ReadSourceOptions {
  signal?: AbortSignal;
}
```

修改 `readSourceAsArrayBuffer`：

```ts
export async function readSourceAsArrayBuffer(
  source: PreviewSource,
  options: ReadSourceOptions = {}
): Promise<ArrayBuffer> {
  switch (source.kind) {
    case "file":
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return source.file.arrayBuffer();

    case "blob":
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return source.blob.arrayBuffer();

    case "arrayBuffer":
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return source.buffer;

    case "url": {
      const response = await fetch(source.url, {
        headers: source.headers,
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      return response.arrayBuffer();
    }

    default:
      throw new Error("Unsupported preview source");
  }
}
```

`readSourceAsText` 和 `readSourceAsBase64` 也同步增加 `options` 参数。

注意：

```txt
File / Blob 的 arrayBuffer() 无法真正中途取消，只能读取前检查 signal.aborted。
远程 url fetch 可以真正取消。
```

---

## 8. 18.1.4：远程 URL 下载进度

修改文件：

```txt
src/components/file-preview/remote-url.ts
```

新增类型：

```ts
export interface RemoteLoadProgress {
  received: number;
  total: number | null;
  percent: number | null;
}

export interface ProcessRemoteUrlOptions {
  signal?: AbortSignal;
  onProgress?: (progress: RemoteLoadProgress) => void;
}
```

修改签名：

```ts
export async function processRemoteUrl(
  rawUrl: string,
  options: ProcessRemoteUrlOptions = {}
): Promise<FileInfo>
```

新增 Content-Length 读取：

```ts
function getContentLength(response: Response): number | null {
  const value = response.headers.get("content-length");
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
```

新增流式读取：

```ts
async function readResponseAsArrayBufferWithProgress(
  response: Response,
  options: ProcessRemoteUrlOptions
): Promise<ArrayBuffer> {
  const total = getContentLength(response);

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    options.onProgress?.({
      received: buffer.byteLength,
      total,
      percent: total ? buffer.byteLength / total : null,
    });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    if (options.signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const { done, value } = await reader.read();

    if (done) break;

    if (value) {
      chunks.push(value);
      received += value.byteLength;

      options.onProgress?.({
        received,
        total,
        percent: total ? received / total : null,
      });
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}
```

替换：

```ts
const buffer = await response.arrayBuffer();
```

为：

```ts
const buffer = await readResponseAsArrayBufferWithProgress(response, options);
```

---

## 9. 18.1.5：远程 URL 取消控制

在 `page.tsx` 引入：

```ts
import {
  processRemoteUrl,
  type RemoteLoadProgress,
} from "@/components/file-preview/remote-url";
```

新增状态：

```ts
const remoteAbortRef = useRef<AbortController | null>(null);
const [remoteProgress, setRemoteProgress] = useState<RemoteLoadProgress | null>(null);
```

修改 `loadRemoteUrl`：

```ts
const loadRemoteUrl = useCallback(async () => {
  if (!remoteUrl.trim()) {
    toast.error("Remote URL is empty");
    return;
  }

  const currentUrl = remoteUrl.trim();
  const controller = new AbortController();

  remoteAbortRef.current = controller;
  setRemoteProgress(null);
  setLoadingRemoteUrl(true);

  try {
    const info = await processRemoteUrl(currentUrl, {
      signal: controller.signal,
      onProgress: setRemoteProgress,
    });

    setFiles((prev) => [...prev, info]);
    setActiveFileId(info.id);
    setRemoteUrl("");
    setRemoteProgress(null);

    toast.success(`Loaded remote file: ${info.name}`);

    if (["ppt", "xls"].includes(info.fileType)) {
      toast.warning(
        `${info.name} is a legacy Office format. Preview is not supported. Please convert to .pptx / .xlsx.`
      );
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      toast.info("Remote file loading cancelled");
      return;
    }

    const message =
      err instanceof Error ? err.message : "Failed to load remote URL";

    toast.error(message, {
      description: "你可以在新标签页打开原始链接下载。",
      action: {
        label: "Open",
        onClick: () => {
          window.open(currentUrl, "_blank", "noopener,noreferrer");
        },
      },
    });
  } finally {
    if (remoteAbortRef.current === controller) {
      remoteAbortRef.current = null;
    }

    setLoadingRemoteUrl(false);
    setRemoteProgress(null);
  }
}, [remoteUrl]);
```

新增取消函数：

```ts
const cancelRemoteLoad = useCallback(() => {
  remoteAbortRef.current?.abort();
}, []);
```

URL 按钮改成 loading 时取消：

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={loadingRemoteUrl ? cancelRemoteLoad : loadRemoteUrl}
  disabled={!loadingRemoteUrl && !remoteUrl.trim()}
  className="h-9 shrink-0 gap-1.5 text-xs"
>
  {loadingRemoteUrl ? "Cancel" : "URL"}
</Button>
```

---

## 10. 18.1.6：远程加载进度 UI

新增格式化函数，可以放在 `page.tsx` 或独立组件中：

```ts
function formatRemoteProgress(progress: RemoteLoadProgress): string {
  if (progress.total) {
    const percent = Math.round((progress.percent ?? 0) * 100);
    return `${formatFileSize(progress.received)} / ${formatFileSize(progress.total)} (${percent}%)`;
  }

  return `${formatFileSize(progress.received)} downloaded`;
}
```

在 URL 输入区下方增加：

```tsx
{loadingRemoteUrl && remoteProgress && (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
      <span>Loading remote file...</span>
      <span>{formatRemoteProgress(remoteProgress)}</span>
    </div>

    {remoteProgress.percent !== null && (
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${Math.min(100, Math.round(remoteProgress.percent * 100))}%`,
          }}
        />
      </div>
    )}
  </div>
)}
```

如果 `percent === null`，只显示：

```txt
8.2 MB downloaded
```

不显示百分比进度条。

---

## 11. 远程加载错误类型增强

扩展 `RemoteUrlErrorCode`：

```ts
export type RemoteUrlErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "NETWORK_OR_CORS"
  | "HTTP_ERROR"
  | "ABORTED"
  | "FILE_TOO_LARGE";
```

在 `processRemoteUrl` 中识别 AbortError：

```ts
catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new RemoteUrlError(
      "ABORTED",
      "Remote file loading cancelled",
      parsedUrl.toString()
    );
  }

  throw new RemoteUrlError(
    "NETWORK_OR_CORS",
    "无法加载远程文件。可能是 URL 不可访问，或目标服务器未允许浏览器跨域访问。",
    parsedUrl.toString()
  );
}
```

`page.tsx` 中可以优先判断：

```ts
if (err instanceof RemoteUrlError && err.code === "ABORTED") {
  toast.info(err.message);
  return;
}
```

---

## 12. 远程文件大小策略

如果 `Content-Length` 可读，可以知道远程文件大小。但 Stage 18.1 第一版建议：

```txt
不在 processRemoteUrl 内强制阻断
只用于进度显示和 FileInfo.size
真正 block / confirm 交给 LargeFileGate
```

原因：

```txt
1. Content-Length 跨域时不一定可读
2. 远程 URL 必须先下载完成才能准确识别 fileType
3. 统一由 LargeFileGate 控制预览前确认，逻辑更集中
```

后续 Stage 18.2 可以再做远程下载前的大小确认。

---

## 13. 测试建议

### 13.1 performance-limits.test.ts

新增：

```txt
src/components/file-preview/__tests__/performance-limits.test.ts
```

测试：

```txt
0MB → normal
20MB → warning
50MB → confirm
100MB → block
```

### 13.2 LargeFileGate 测试

测试：

```txt
normal 文件直接渲染 children
warning 显示 warning + children
confirm 显示确认界面
confirm 点击后渲染 children
block 显示阻止界面
```

### 13.3 remote progress 测试

可以先测试纯函数：

```txt
getContentLength
formatRemoteProgress
AbortError 分支
```

### 13.4 手动测试

准备：

```txt
小文件：< 20MB
中等文件：20-50MB
大文件：50-100MB
超大文件：> 100MB
远程 DOCX / PPTX
远程大文件
CORS 失败 URL
Cancel 操作
```

---

## 14. 文档更新

新增：

```txt
docs/stage-18-1-large-file-and-remote-loading.md
docs/performance-and-large-file-policy.md
```

README Roadmap 更新：

```txt
Stage 18.0：Source-first 数据模型与 Legacy Renderer 退场 ✅
Stage 18.1：大文件策略与远程加载控制
Stage 18.2：错误边界与 Plugin fallback
Stage 18.3：Worker 化重任务
```

用户文档补充：

```txt
FileVista runs entirely in the browser.
Large files may require confirmation before preview.
Very large files may be blocked from browser-side preview by default.
Remote URL loading can be cancelled.
Remote progress depends on browser Fetch streaming and target server headers.
```

---

## 15. 验收标准

Stage 18.1 完成后应满足：

```txt
1. 有统一 PREVIEW_SIZE_LIMITS
2. 有 getPreviewSizePolicy()
3. 大于 20MB 文件显示 warning
4. 大于 50MB 文件需要确认后预览
5. 大于 100MB 文件默认阻止浏览器预览
6. 本地文件选择后不立即读取内容
7. LargeFileGate 在 PluginPreviewRenderer 外层生效
8. 远程 URL 加载支持 AbortController
9. 远程 URL 加载中可以取消
10. 取消后不红屏、不显示错误 toast
11. 远程 URL 加载支持 downloaded bytes
12. Content-Length 可读时显示百分比
13. Content-Length 不可读时显示已下载大小
14. CORS 失败仍有 Open 原链接兜底
15. source-first 架构不回退到 content/base64 主链路
16. bun run check 通过
17. bun run build:pages 通过
```

---

## 16. 风险点

### 16.1 File / Blob 无法真正中途取消

`file.arrayBuffer()` / `blob.arrayBuffer()` 不支持 AbortSignal 中途取消。当前只能读取前检查 aborted。远程 fetch 才能真正取消。

### 16.2 Content-Length 跨域不可读

跨域时 `Content-Length` 默认不一定可读，除非目标服务器配置：

```txt
Access-Control-Expose-Headers: Content-Length
```

所以进度 UI 必须支持没有百分比的模式。

### 16.3 Stream Reader 兼容性

现代浏览器支持 `response.body.getReader()`，但仍要 fallback 到 `response.arrayBuffer()`。

### 16.4 大文件阈值需要集中配置

阈值必须集中在 `performance-limits.ts`，不要散落在组件中。

---

## 17. 推荐实施顺序

严格按这个顺序：

```txt
1. performance-limits.ts
2. LargeFileGate.tsx
3. page.tsx 接入本地大文件 gate
4. source.ts 支持 signal
5. remote-url.ts 支持 signal + progress
6. page.tsx 接入 remote progress + cancel
7. 测试
8. 文档
```

完成后再进入 Stage 18.2：

```txt
错误边界与 Plugin fallback
```

---

## 18. 阶段结论

Stage 18.1 的最终目标是：

```txt
文件可以大，但用户必须知道风险
远程可以慢，但用户必须能看到进度
加载可以失败，但用户必须能取消和兜底
```

完成后，FileVista 的体验会从：

```txt
上传 / 远程加载后等待，不确定是否卡死
```

升级为：

```txt
有提示
有确认
有进度
可取消
有兜底
```
