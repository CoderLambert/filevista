# FileVista Stage 18.0 完全实现参考文档：Source-first 数据模型与 Legacy Renderer 退场

## 1. 阶段定位

Stage 18.0 是 Stage 18 性能优化前的架构清理阶段。

它不直接做下载进度、AbortController、Worker 化或大文件阈值，而是先解决当前性能问题的根源：

```txt
FileInfo 同时保存 source / content / url
本地文件上传时提前读取内容
二进制文件提前生成 base64
Legacy Renderer 仍作为公开入口
Plugin Adapter 仍部分依赖 file.content / file.url
```

Stage 18.0 的目标是把预览链路改成：

```txt
FileInfo.source 为主数据源
Plugin Renderer 为唯一公开入口
Adapter 按需从 source 读取
content / url 只作为 deprecated 兼容字段
```

完成后，再进入：

```txt
Stage 18.1：大文件策略、远程加载进度、取消机制
Stage 18.2：错误边界与 Plugin fallback
Stage 18.3：Worker 化重任务
```

---

## 2. 当前问题

当前 `FileInfo` 模型大致是：

```ts
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;
  content: string | null;
  url: string | null;
  source?: PreviewSource;
}
```

问题：

```txt
1. source 是新模型，但仍是可选字段
2. content 是旧模型，保存文本或 base64
3. url 是旧模型，主要保存 object URL
4. 本地上传会提前 readAsText / readAsDataURL
5. 远程 URL 会 fetch 成 ArrayBuffer 后再额外生成 base64
6. 大文件会出现多份内存副本
7. Legacy Renderer 仍然作为 UI 入口存在
```

大文件内存风险示例：

```txt
80MB PPTX
→ 原始 File / ArrayBuffer 80MB
→ base64 content 约 106MB
→ 预览库解析中间数据
→ DOM / Canvas / workbook 结构
最终内存可能超过 200MB
```

---

## 3. 阶段目标

Stage 18.0 要完成：

```txt
1. 首页移除 Legacy / Plugin Renderer 切换
2. 默认只使用 PluginPreviewRenderer
3. FileInfo.source 改为必填
4. FileInfo.content / FileInfo.url 改为 deprecated 可选字段
5. 本地文件上传不再提前读取文件内容
6. 远程 URL 不再主动生成 base64 content
7. Demo Files 也逐步 source-first
8. 文本类 Adapter 改为 readSourceAsText
9. 二进制类 Adapter 改为 source-first 或按需 readSourceAsBase64
10. media Adapter 从 source 创建 object URL
11. UnsupportedPluginPreview 支持 source 下载
12. 保留 Legacy 组件源码，但不再作为公开入口
```

---

## 4. 本阶段不做

```txt
不新增文件类型
不实现 .ppt / .xls 旧版 Office 预览
不做远程下载进度
不做 AbortController
不做 Worker 化
不做大文件阈值拦截
不立刻删除 FilePreviewRenderer.tsx
不立刻删除所有旧 Preview 组件
不立刻物理删除 content / url 字段
```

---

## 5. 推荐提交拆分

建议拆成 8 个小提交：

```txt
18.0.1 refactor: make plugin renderer the default preview entry
18.0.2 refactor: make file info source-first
18.0.3 refactor: avoid eager local file reads
18.0.4 refactor: avoid eager base64 generation for remote files
18.0.5 refactor: read text previews from source
18.0.6 refactor: read binary previews from source
18.0.7 refactor: create media object urls from source
18.0.8 refactor: support source-based fallback downloads
```

---

# 6. 18.0.1：Plugin Renderer 成为唯一公开入口

## 修改文件

```txt
src/app/page.tsx
```

## 删除 import

删除：

```ts
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabCacheRenderer } from "@/components/file-preview/FilePreviewRenderer";
```

保留：

```ts
import { PluginPreviewRenderer } from "@/components/file-preview/PluginPreviewRenderer";
```

## 删除状态

删除：

```ts
const [previewEngine, setPreviewEngine] =
  useState<"legacy" | "plugin">("legacy");
```

## 删除 UI 切换

删除 Legacy / Plugin 的 Tabs 切换区域。

## 替换渲染入口

旧逻辑：

```tsx
{previewEngine === "legacy" ? (
  <TabCacheRenderer files={files} activeFileId={activeFileId} />
) : (
  <PluginPreviewRenderer file={activeFile} />
)}
```

新逻辑：

```tsx
{activeFile ? (
  <PluginPreviewRenderer
    file={activeFile}
    showPluginDebug={process.env.NODE_ENV === "development"}
  />
) : (
  <EmptyState />
)}
```

## 注意

不要删除：

```txt
src/components/file-preview/FilePreviewRenderer.tsx
```

原因：旧 Preview 组件和部分 Adapter 仍可能复用它的组件。

---

# 7. 18.0.2：FileInfo 改为 source-first

## 修改文件

```txt
src/components/file-preview/utils.ts
```

## 修改接口

改成：

```ts
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  fileType: FileType;

  /**
   * Primary source abstraction.
   *
   * Stage 18.0 makes source mandatory. Preview adapters should read
   * file data from this field via readSourceAsText/readSourceAsArrayBuffer.
   */
  source: PreviewSource;

  /**
   * @deprecated Use source + readSourceAsText/readSourceAsArrayBuffer instead.
   *
   * Temporary compatibility field for legacy preview components.
   * New code should not populate or depend on this field.
   */
  content?: string | null;

  /**
   * @deprecated Use source or adapter-local object URL instead.
   *
   * Temporary compatibility field for legacy media preview components.
   * New code should not populate or depend on this field.
   */
  url?: string | null;
}
```

## 迁移影响

所有构造 `FileInfo` 的地方都必须提供 `source`：

```txt
src/app/page.tsx
src/components/file-preview/demos.ts
src/components/file-preview/remote-url.ts
测试文件
```

---

# 8. 18.0.3：本地上传不再预读

## 修改文件

```txt
src/app/page.tsx
```

## 新 processFile

用这个替换当前提前读取内容的逻辑：

```ts
const processFile = useCallback(async (file: File): Promise<FileInfo> => {
  const fileType = detectFileType(file.name, file.type);

  return {
    id: generateId(),
    name: file.name,
    size: file.size,
    type: file.type,
    fileType,
    source: {
      kind: "file",
      file,
    },
  };
}, []);
```

## 删除逻辑

删除：

```txt
isBinary
FileReader.readAsDataURL
FileReader.readAsText
URL.createObjectURL(file)
content
url
```

## revokeFileResources 调整

如果还保留兼容 url 字段，建议改成：

```ts
function revokeFileResources(file: FileInfo) {
  if (file.url?.startsWith("blob:")) {
    URL.revokeObjectURL(file.url);
  }
}
```

后续 media Adapter 自己创建和释放 object URL 后，这个函数可以进一步简化。

---

# 9. 18.0.4：Remote URL 不再生成 base64 content

## 修改文件

```txt
src/components/file-preview/remote-url.ts
```

## 删除主动 content/url 构造

`processRemoteUrl()` 不再做：

```txt
arrayBufferToBase64(buffer)
content = base64
objectUrl = URL.createObjectURL(...)
TextDecoder decode
```

## 新返回结构

```ts
return {
  id: generateId(),
  name: fileNameResult.fileName,
  size: buffer.byteLength,
  type: mimeResult.mimeType,
  fileType,
  source: {
    kind: "arrayBuffer",
    buffer,
    name: fileNameResult.fileName,
    mimeType: mimeResult.mimeType,
  },
};
```

## 保留

仍然保留：

```txt
URL 校验
fetch
Content-Type 读取
Content-Disposition / query / pathname 文件名解析
magic sniff
ZIP 容器识别
MIME 综合判断
```

## 结果

远程文件进入系统时只保存 ArrayBuffer source，不额外保存 base64 content。

---

# 10. 18.0.5：新增 source 读取 hooks

建议新增目录：

```txt
src/components/file-preview/hooks/
```

## 10.1 useSourceText

新增：

```txt
src/components/file-preview/hooks/useSourceText.ts
```

内容：

```ts
"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsText } from "../core/source";

export interface SourceTextState {
  content: string | null;
  loading: boolean;
  error: Error | null;
}

export function useSourceText(source: PreviewSource): SourceTextState {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setContent(null);

    readSourceAsText(source)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return { content, loading, error };
}
```

## 10.2 useSourceBase64

新增：

```txt
src/components/file-preview/hooks/useSourceBase64.ts
```

内容：

```ts
"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsBase64 } from "../core/source";

export interface SourceBase64State {
  content: string | null;
  loading: boolean;
  error: Error | null;
}

export function useSourceBase64(source: PreviewSource): SourceBase64State {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setContent(null);

    readSourceAsBase64(source)
      .then((base64) => {
        if (!cancelled) {
          setContent(base64);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return { content, loading, error };
}
```

## 10.3 useObjectUrlFromSource

新增：

```txt
src/components/file-preview/hooks/useObjectUrlFromSource.ts
```

内容：

```ts
"use client";

import { useEffect, useState } from "react";
import type { PreviewSource } from "../core/types";
import { readSourceAsArrayBuffer } from "../core/source";

export function useObjectUrlFromSource(
  source: PreviewSource,
  mimeType?: string
): {
  objectUrl: string | null;
  loading: boolean;
  error: Error | null;
} {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);
    setObjectUrl(null);

    async function run() {
      try {
        if (source.kind === "file") {
          createdUrl = URL.createObjectURL(source.file);
        } else if (source.kind === "blob") {
          createdUrl = URL.createObjectURL(source.blob);
        } else {
          const buffer = await readSourceAsArrayBuffer(source);
          const blob = new Blob([buffer], {
            type: mimeType || "application/octet-stream",
          });
          createdUrl = URL.createObjectURL(blob);
        }

        if (!cancelled) {
          setObjectUrl(createdUrl);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [source, mimeType]);

  return { objectUrl, loading, error };
}
```

---

# 11. 18.0.6：文本类 Adapter 改造

优先改：

```txt
MarkdownPreviewAdapter
SourceCodePreviewAdapter
TextPreviewAdapter
CsvPreviewAdapter
HtmlPreviewAdapter
SvgPreviewAdapter
RtfPreviewAdapter
```

## Adapter 模板

```tsx
"use client";

import type { FileInfo } from "../utils";
import { useSourceText } from "../hooks/useSourceText";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function TextLikePreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceText(file.source);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  if (error || content === null) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to read file"
        description={error?.message ?? "Unable to read file source."}
      />
    );
  }

  return (
    // 调用对应旧 Preview 组件
    // <TextPreview content={content} fileName={file.name} />
    null
  );
}
```

## Code / JSON 示例

```tsx
return (
  <CodePreview
    content={content}
    fileName={file.name}
    isJson={file.fileType === "json"}
  />
);
```

## Markdown 示例

```tsx
return <MarkdownPreview content={content} />;
```

---

# 12. 18.0.7：二进制 Adapter 改造

优先改：

```txt
PdfPreviewAdapter
DocxPreviewAdapter
PptxPreviewAdapter
XlsxPreviewAdapter
ZipPreviewAdapter
EpubPreviewAdapter
```

## 已支持 source 的组件

如果底层 Preview 组件已经支持 `source`，直接传：

```tsx
<PdfPreview
  content={undefined}
  source={file.source}
  fileName={file.name}
/>
```

```tsx
<DocxPreview
  content={undefined}
  source={file.source}
  fileName={file.name}
/>
```

```tsx
<PptxPreview
  content={undefined}
  source={file.source}
  fileName={file.name}
/>
```

```tsx
<XlsxPreview
  content={undefined}
  source={file.source}
  fileName={file.name}
  fileSize={file.size}
/>
```

## 仍只支持 base64 的组件

如果底层组件仍只接受 base64，例如某些 ZIP / EPUB 组件，可以在 Adapter 中按需读取：

```tsx
"use client";

import type { FileInfo } from "../utils";
import { useSourceBase64 } from "../hooks/useSourceBase64";
import { ZipPreview } from "../ZipPreview";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function ZipPreviewAdapter({ file }: { file: FileInfo }) {
  const { content, loading, error } = useSourceBase64(file.source);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading ZIP...</div>;
  }

  if (error || !content) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to read ZIP"
        description={error?.message ?? "Unable to read ZIP source."}
      />
    );
  }

  return <ZipPreview content={content} fileName={file.name} />;
}
```

这样虽然仍会生成 base64，但只在用户真正预览 ZIP 时生成，不再在文件进入系统时生成。

---

# 13. 18.0.8：Media Adapter 改造

改：

```txt
ImagePreviewAdapter
VideoPreviewAdapter
AudioPreviewAdapter
```

## Image 示例

```tsx
"use client";

import type { FileInfo } from "../utils";
import { ImagePreview } from "../ImagePreview";
import { useObjectUrlFromSource } from "../hooks/useObjectUrlFromSource";
import { UnsupportedPluginPreview } from "./UnsupportedPluginPreview";

export default function ImagePreviewAdapter({ file }: { file: FileInfo }) {
  const { objectUrl, loading, error } = useObjectUrlFromSource(
    file.source,
    file.type
  );

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading image...</div>;
  }

  if (error || !objectUrl) {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        fileName={file.name}
        title="Failed to load image"
        description={error?.message ?? "Unable to create image preview."}
      />
    );
  }

  return <ImagePreview url={objectUrl} fileName={file.name} />;
}
```

Video / Audio 同理。

---

# 14. 18.0.9：UnsupportedPluginPreview 支持 source 下载

## 新增下载工具

新增：

```txt
src/components/file-preview/core/download.ts
```

内容：

```ts
import type { PreviewSource } from "./types";
import { readSourceAsArrayBuffer } from "./source";

export async function downloadSource(
  source: PreviewSource,
  fileName: string,
  mimeType?: string
): Promise<void> {
  const buffer = await readSourceAsArrayBuffer(source);
  const blob = new Blob([buffer], {
    type: mimeType || "application/octet-stream",
  });

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

## 修改 UnsupportedPluginPreview Props

```ts
interface UnsupportedPluginPreviewProps {
  fileType: FileType;
  fileName?: string;
  content?: string | null;
  source?: PreviewSource;
  title?: string;
  description?: string;
}
```

## 下载优先级

```txt
1. source
2. content base64 fallback
```

伪代码：

```ts
async function handleDownload() {
  if (source && fileName) {
    await downloadSource(source, fileName);
    return;
  }

  if (content && fileName) {
    // existing base64 download fallback
  }
}
```

## 修改 PluginPreviewRenderer

将旧版 Office fallback 从：

```tsx
<UnsupportedPluginPreview
  fileType={file.fileType}
  fileName={file.name}
  content={file.content}
/>
```

改为：

```tsx
<UnsupportedPluginPreview
  fileType={file.fileType}
  fileName={file.name}
  source={file.source}
  content={file.content}
/>
```

---

# 15. Demo Files 迁移

## Text Demo

旧：

```ts
content: demo.content
```

新：

```ts
const blob = new Blob([demo.content], { type: demo.type });

return {
  id: generateId(),
  name: demo.name,
  size: blob.size,
  type: demo.type,
  fileType: detectFileType(demo.name, demo.type),
  source: {
    kind: "blob",
    blob,
    name: demo.name,
    mimeType: demo.type,
  },
};
```

## Binary Demo

如果已经有 ArrayBuffer：

```ts
return {
  id: generateId(),
  name: demo.name,
  size: demo.size,
  type: demo.type,
  fileType: detectFileType(demo.name, demo.type),
  source: {
    kind: "arrayBuffer",
    buffer,
    name: demo.name,
    mimeType: demo.type,
  },
};
```

---

# 16. 需要检查的 Adapter 清单

逐个检查：

```txt
src/components/file-preview/preview-adapters/PdfPreviewAdapter.tsx
src/components/file-preview/preview-adapters/DocxPreviewAdapter.tsx
src/components/file-preview/preview-adapters/PptxPreviewAdapter.tsx
src/components/file-preview/preview-adapters/XlsxPreviewAdapter.tsx
src/components/file-preview/preview-adapters/MarkdownPreviewAdapter.tsx
src/components/file-preview/preview-adapters/SourceCodePreviewAdapter.tsx
src/components/file-preview/preview-adapters/TextPreviewAdapter.tsx
src/components/file-preview/preview-adapters/CsvPreviewAdapter.tsx
src/components/file-preview/preview-adapters/HtmlPreviewAdapter.tsx
src/components/file-preview/preview-adapters/SvgPreviewAdapter.tsx
src/components/file-preview/preview-adapters/RtfPreviewAdapter.tsx
src/components/file-preview/preview-adapters/ZipPreviewAdapter.tsx
src/components/file-preview/preview-adapters/EpubPreviewAdapter.tsx
src/components/file-preview/preview-adapters/ImagePreviewAdapter.tsx
src/components/file-preview/preview-adapters/VideoPreviewAdapter.tsx
src/components/file-preview/preview-adapters/AudioPreviewAdapter.tsx
src/components/file-preview/preview-adapters/UnsupportedPluginPreview.tsx
```

目标：

```txt
不再直接依赖 file.content
不再直接依赖 file.url
优先使用 file.source
```

过渡期允许：

```ts
const content = file.content ?? await readSourceAsText(file.source);
```

但新代码不要再主动填充 `content`。

---

# 17. 测试清单

## 17.1 构建测试

```bash
bun run lint
bun run test:run
bun run build
bun run build:pages
```

或：

```bash
bun run check
bun run build:pages
```

## 17.2 功能测试

必须测试：

```txt
PDF
DOCX
PPTX
XLSX
Markdown
JSON
Code
CSV
Text
HTML
SVG
RTF
ZIP
EPUB
Image
Video
Audio
Remote URL PPTX
Remote URL DOCX
旧版 PPT
旧版 XLS
```

## 17.3 行为测试

确认：

```txt
首页没有 Legacy / Plugin 切换
上传文件后不会明显卡顿
文件加入列表更快
打开预览时才读取内容
远程 URL 不再生成 base64 content
旧版 Office 仍有不支持提示和下载能力
CORS 失败仍有 Open 原链接
```

---

# 18. 文档更新

新增：

```txt
docs/stage-18-0-source-first-prd.md
docs/stage-18-0-source-first-implementation.md
```

更新：

```txt
README.md
docs/plugin-development-guide.md
docs/preview-plugin-validation-matrix.md
```

Plugin 开发指南补充：

```txt
新 Plugin Adapter 必须优先从 file.source 读取数据，不得依赖 file.content / file.url。
```

README Roadmap 可改为：

```txt
Stage 18.0：Source-first 数据模型与 Legacy Renderer 退场
Stage 18.1：大文件策略与远程加载控制
```

---

# 19. 验收标准

Stage 18.0 完成后：

```txt
1. 首页不再展示 Legacy / Plugin Renderer 切换
2. 首页默认只使用 PluginPreviewRenderer
3. FileInfo.source 为必填
4. FileInfo.content 为 deprecated 可选
5. FileInfo.url 为 deprecated 可选
6. 本地上传不再提前 readAsText
7. 本地上传不再提前 readAsDataURL
8. 远程 URL 不再主动生成 base64 content
9. 文本类 Adapter 从 readSourceAsText 读取
10. 二进制类 Adapter 从 source 读取或按需 readSourceAsBase64
11. media Adapter 从 source 创建 object URL
12. UnsupportedPluginPreview 支持 source 下载
13. 常见文件类型仍可预览
14. 旧版 Office 仍能显示不支持提示
15. CORS 失败仍可 Open 原始链接
16. bun run check 通过
17. bun run build:pages 通过
```

---

# 20. 回滚策略

## Plugin Renderer 唯一入口出问题

短期恢复 Legacy / Plugin 切换 UI。

## 某个 Adapter source-first 出问题

临时 fallback：

```ts
const content = file.content ?? await readSourceAsText(file.source);
```

或：

```ts
const base64 = file.content ?? await readSourceAsBase64(file.source);
```

## source 必填导致大量类型错误

短期保留：

```ts
source?: PreviewSource;
```

但新增 FileInfo 仍必须补 source。等适配完成后再改必填。

---

# 21. 最终建议

严格按顺序推进：

```txt
1. 先隐藏 Legacy UI
2. 再 source 必填
3. 再停止本地预读
4. 再停止远程 base64
5. 再迁移文本 Adapter
6. 再迁移二进制 Adapter
7. 再迁移 media Adapter
8. 最后改 unsupported 下载
```

不要一次性大改。

Stage 18.0 完成后，再进入真正的：

```txt
Stage 18.1：大文件策略、远程加载进度和取消机制
```
