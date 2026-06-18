# RTF 纯前端渲染升级方案

> 目标文件路径建议：`docs/rtf-preview-rendering-plan.md`  
> 适用项目：FileVista  
> 目标：将当前 `.rtf` 的“文本提取预览”升级为“HTML 富文本渲染 + 安全隔离 + 文本降级”的纯前端方案。

---

## 1. 背景与目标

FileVista 当前定位是一个纯浏览器端文件预览工具集，核心目标是不依赖服务端，支持 `File / Blob / ArrayBuffer / URL` 等数据源，并通过插件化 Preview Renderer 按文件类型懒加载预览能力。

当前 README 中 `.rtf` 已列入支持类型，但能力定位仍是“文本提取预览”。这意味着用户可以看到基础文字内容，但无法较好展示 RTF 中的字号、颜色、段落、加粗、斜体、下划线、图片等富文本信息。

本方案目标是将 RTF 支持升级为：

```txt
RTF 文件
  -> 纯前端读取 ArrayBuffer
  -> rtf.js 解析并渲染为 HTML DOM
  -> DOMPurify 清洗
  -> iframe sandbox / Shadow DOM 隔离展示
  -> 失败时回退到纯文本提取
```

本方案仍坚持 FileVista 的核心边界：

```txt
1. 不依赖服务端转换
2. 不上传用户文件
3. 按文件类型懒加载重型依赖
4. 不承诺 Word 级别高保真
5. 优先保证安全、稳定和可降级
```

---

## 2. 推荐结论

RTF 最佳纯前端方案建议采用：

```txt
主渲染库：rtf.js
安全清洗：dompurify
渲染隔离：iframe sandbox srcDoc，必要时可选 Shadow DOM
失败降级：保留现有文本提取能力
```

其中：

- `rtf.js`：负责将 RTF 渲染为 HTML elements。
- `dompurify`：负责清洗最终 HTML，降低 XSS 风险。
- `iframe sandbox`：负责样式和脚本隔离，避免污染 FileVista 主应用。
- fallback 文本提取：负责兼容复杂、损坏或不受支持的 RTF 文件。

---

## 3. 不推荐路线

### 3.1 不推荐只做正则解析

RTF 虽然是文本格式，但并不是简单标记语言。它包含控制词、分组、编码页、Unicode 转义、嵌入图片、字体表、颜色表、样式表等结构。

仅用正则做解析容易出现：

```txt
1. 中文/多语言编码异常
2. 表格、图片、样式丢失
3. 嵌套分组处理错误
4. 特殊控制词误删正文
5. 对坏文件缺少恢复能力
```

正则方案只适合作为渲染失败后的 fallback，不适合作为主渲染方案。

### 3.2 不推荐引入服务端转换

服务端可通过 LibreOffice、unrtf、pandoc 等工具将 RTF 转成 HTML/PDF，但这会破坏 FileVista 的核心定位：

```txt
1. 文件需要上传到服务端
2. 部署复杂度上升
3. GitHub Pages Demo 无法使用
4. 隐私边界变差
5. 转换服务需要额外维护
```

因此本项目中 RTF 必须继续坚持纯前端路线。

### 3.3 不推荐承诺高保真

RTF 是非常老的富文本交换格式。复杂表格、页眉页脚、分页、OLE 对象、公式、复杂图片、嵌入对象等内容，纯前端开源生态无法稳定达到 Microsoft Word 级别高保真。

FileVista 对外说明建议写成：

```txt
RTF：支持基础富文本渲染，复杂排版和嵌入对象可能降级为文本预览。
```

---

## 4. 依赖安装

建议新增依赖：

```bash
bun add rtf.js dompurify
```

如果 TypeScript 缺少类型提示，可以先添加一个本地声明文件：

```txt
src/types/rtf-js.d.ts
```

内容：

```ts
declare module "rtf.js" {
  export const RTFJS: {
    loggingEnabled(enabled: boolean): void;
    Document: new (buffer: ArrayBuffer | Uint8Array) => {
      render(): Promise<HTMLElement[]>;
    };
  };

  export const WMFJS: {
    loggingEnabled(enabled: boolean): void;
  };

  export const EMFJS: {
    loggingEnabled(enabled: boolean): void;
  };
}
```

如果实际版本导出结构不同，以本地 `node_modules/rtf.js` 的入口为准调整。

---

## 5. 文件识别策略

RTF 不建议只依赖 MIME，因为远程 URL、对象存储、GitHub Pages、OSS、S3 等场景经常返回不准确的 MIME。

建议采用三层判断：

```txt
1. 扩展名：.rtf
2. MIME：text/rtf / application/rtf / application/x-rtf
3. Magic Header：文件头是否以 "{\rtf" 开始
```

示例工具函数：

```ts
export async function isRtfBlob(
  file: Blob,
  filename?: string,
): Promise<boolean> {
  const nameMatched = filename ? /\.rtf$/i.test(filename) : false;

  const typeMatched =
    file.type === "text/rtf" ||
    file.type === "application/rtf" ||
    file.type === "application/x-rtf";

  const head = await file
    .slice(0, 16)
    .text()
    .catch(() => "");
  const magicMatched = head.startsWith("{\\rtf");

  return nameMatched || typeMatched || magicMatched;
}
```

FileVista 现有 `detectFileType()` 中可以先保留扩展名和 MIME 识别，Magic Header 适合作为后续增强，因为当前同步检测函数如果不是 async，强行改造会影响面较大。

---

## 6. 插件结构设计

建议新增或升级以下文件：

```txt
src/components/file-preview/plugins/rtf-plugin.ts
src/components/file-preview/preview-adapters/RtfPreviewAdapter.tsx
src/components/file-preview/previewers/rtf/RtfHtmlPreview.tsx
src/components/file-preview/previewers/rtf/extract-rtf-text.ts
src/components/file-preview/previewers/rtf/build-rtf-src-doc.ts
src/types/rtf-js.d.ts
```

推荐职责拆分：

```txt
rtf-plugin.ts
  只负责插件声明、match、load

RtfPreviewAdapter.tsx
  只负责把 FileInfo 转成 RtfHtmlPreview 需要的 props

RtfHtmlPreview.tsx
  负责读取 Blob/ArrayBuffer、动态加载 rtf.js、渲染状态、错误降级

build-rtf-src-doc.ts
  负责组装 iframe srcDoc

extract-rtf-text.ts
  负责失败后的纯文本提取
```

---

## 7. 插件注册示例

### 7.1 新增 rtf plugin

```ts
// src/components/file-preview/plugins/rtf-plugin.ts

import type { PreviewPlugin } from "../core/plugin";

export const rtfPlugin: PreviewPlugin = {
  id: "builtin.rtf",
  name: "RTF Preview",
  priority: 100,
  match: (file) => file.fileType === "rtf",
  load: () => import("../preview-adapters/RtfPreviewAdapter"),
};
```

### 7.2 注册到 builtin plugins

```ts
// src/components/file-preview/plugins/builtin-plugins.ts

import { rtfPlugin } from "./rtf-plugin";

export const builtinPreviewPlugins = [
  // ...
  rtfPlugin,
];
```

如果当前项目已经存在 `rtfPlugin`，则直接升级它的 adapter，不需要重复创建。

---

## 8. Adapter 示例

```tsx
// src/components/file-preview/preview-adapters/RtfPreviewAdapter.tsx

import type { FileInfo } from "../types";
import { UnsupportedPluginPreview } from "../components/UnsupportedPluginPreview";
import { RtfHtmlPreview } from "../previewers/rtf/RtfHtmlPreview";

export default function RtfPreviewAdapter({ file }: { file: FileInfo }) {
  if (!file) {
    return (
      <UnsupportedPluginPreview
        file={file}
        reason="RTF 文件信息不存在，无法预览。"
      />
    );
  }

  return <RtfHtmlPreview file={file} />;
}
```

> 注意：请根据 FileVista 项目中真实的 `FileInfo`、`UnsupportedPluginPreview` 路径调整 import。

---

## 9. RTF HTML Preview 示例

下面代码是建议骨架，需要结合 FileVista 当前 `FileInfo` 数据结构适配 `Blob / ArrayBuffer / URL` 的读取方式。

```tsx
// src/components/file-preview/previewers/rtf/RtfHtmlPreview.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";

import { buildRtfSrcDoc } from "./build-rtf-src-doc";
import { extractPlainTextFromRtf } from "./extract-rtf-text";

type RtfHtmlPreviewProps = {
  file: {
    name?: string;
    size?: number;
    content?: string | ArrayBuffer;
    blob?: Blob;
    source?: Blob | ArrayBuffer | string;
    url?: string;
  };
};

type PreviewState =
  | { status: "loading" }
  | { status: "html"; srcDoc: string }
  | { status: "text"; text: string; reason: string }
  | { status: "error"; message: string };

const RTF_LARGE_FILE_LIMIT = 10 * 1024 * 1024;

export function RtfHtmlPreview({ file }: RtfHtmlPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  const fileSize = file.size ?? 0;
  const isLarge = fileSize >= RTF_LARGE_FILE_LIMIT;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setState({ status: "loading" });

        const blob = await resolveFileToBlob(file);

        if (blob.size >= RTF_LARGE_FILE_LIMIT) {
          const text = await blob.text();
          setState({
            status: "text",
            text: extractPlainTextFromRtf(text),
            reason: "RTF 文件较大，为避免浏览器卡顿，已降级为纯文本预览。",
          });
          return;
        }

        const buffer = await blob.arrayBuffer();

        const { RTFJS, WMFJS, EMFJS } = await import("rtf.js");

        RTFJS.loggingEnabled(false);
        WMFJS?.loggingEnabled?.(false);
        EMFJS?.loggingEnabled?.(false);

        const doc = new RTFJS.Document(buffer);
        const elements = await doc.render();

        const wrapper = document.createElement("div");
        wrapper.className = "rtf-document";
        wrapper.append(...elements);

        const safeHtml = DOMPurify.sanitize(wrapper.innerHTML, {
          USE_PROFILES: {
            html: true,
            svg: true,
            svgFilters: true,
          },
          ADD_ATTR: ["target", "rel"],
        });

        const srcDoc = buildRtfSrcDoc(safeHtml);

        if (!cancelled) {
          setState({ status: "html", srcDoc });
        }
      } catch (error) {
        console.error("[FileVista][RTF] render failed:", error);

        try {
          const blob = await resolveFileToBlob(file);
          const text = await blob.text();

          if (!cancelled) {
            setState({
              status: "text",
              text: extractPlainTextFromRtf(text),
              reason: "RTF 富文本渲染失败，已降级为纯文本预览。",
            });
          }
        } catch {
          if (!cancelled) {
            setState({
              status: "error",
              message:
                "RTF 文件解析失败，可能包含复杂排版、嵌入对象、特殊编码或损坏内容。",
            });
          }
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (state.status === "loading") {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        正在解析 RTF 文件...
      </div>
    );
  }

  if (state.status === "error") {
    return <div className="p-4 text-sm text-destructive">{state.message}</div>;
  }

  if (state.status === "text") {
    return (
      <div className="h-full overflow-auto p-4">
        <div className="mb-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {state.reason}
        </div>
        <pre className="whitespace-pre-wrap break-words text-sm leading-6">
          {state.text}
        </pre>
      </div>
    );
  }

  return (
    <iframe
      title={file.name ? `RTF Preview - ${file.name}` : "RTF Preview"}
      sandbox=""
      srcDoc={state.srcDoc}
      className="h-full min-h-[600px] w-full rounded-md border bg-white"
    />
  );
}

async function resolveFileToBlob(
  file: RtfHtmlPreviewProps["file"],
): Promise<Blob> {
  if (file.blob) {
    return file.blob;
  }

  if (file.source instanceof Blob) {
    return file.source;
  }

  if (file.source instanceof ArrayBuffer) {
    return new Blob([file.source], { type: "text/rtf" });
  }

  if (file.content instanceof ArrayBuffer) {
    return new Blob([file.content], { type: "text/rtf" });
  }

  if (typeof file.content === "string") {
    return new Blob([file.content], { type: "text/rtf" });
  }

  if (typeof file.source === "string") {
    return new Blob([file.source], { type: "text/rtf" });
  }

  if (file.url) {
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RTF file: ${response.status}`);
    }
    return await response.blob();
  }

  throw new Error("Unsupported RTF input source");
}
```

---

## 10. iframe srcDoc 构造

```ts
// src/components/file-preview/previewers/rtf/build-rtf-src-doc.ts

export function buildRtfSrcDoc(safeHtml: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline';"
  />
  <style>
    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    body {
      box-sizing: border-box;
      padding: 24px;
    }

    .rtf-document {
      max-width: 920px;
      margin: 0 auto;
      line-height: 1.6;
      word-break: break-word;
    }

    img,
    svg {
      max-width: 100%;
      height: auto;
    }

    table {
      max-width: 100%;
      border-collapse: collapse;
    }

    td,
    th {
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      vertical-align: top;
    }

    p {
      margin: 0 0 0.75em;
    }
  </style>
</head>
<body>
  <div class="rtf-document">${safeHtml}</div>
</body>
</html>`;
}
```

---

## 11. 文本降级工具

```ts
// src/components/file-preview/previewers/rtf/extract-rtf-text.ts

export function extractPlainTextFromRtf(rtf: string) {
  return rtf
    .replace(/{\\fonttbl[\s\S]*?}/g, "")
    .replace(/{\\colortbl[\s\S]*?}/g, "")
    .replace(/{\\stylesheet[\s\S]*?}/g, "")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\line/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\u(-?\d+)\??/g, (_, value) => {
      const code = Number(value);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    })
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

这个工具不是完整 RTF parser，只作为最后兜底。主渲染仍应交给 `rtf.js`。

---

## 12. 安全策略

RTF 渲染链路必须遵守以下约束：

```txt
1. 不直接将 rtf.js 输出内容插入主 DOM
2. 必须经过 DOMPurify 清洗
3. 优先使用 iframe sandbox="" 隔离
4. srcDoc 内添加 CSP，禁止 script 和外部资源
5. img-src 只允许 data: / blob:
6. 不执行 RTF 中可能转出的链接脚本
7. 不加载外部字体、外部 CSS、外部 JS
```

推荐渲染路径：

```txt
RTFJS.render()
  -> HTMLElement[]
  -> wrapper.innerHTML
  -> DOMPurify.sanitize()
  -> buildRtfSrcDoc()
  -> iframe sandbox srcDoc
```

---

## 13. 大文件策略

RTF 解析会发生在浏览器主线程。为避免页面卡顿，建议设定大小阈值：

```ts
const RTF_LARGE_FILE_LIMIT = 10 * 1024 * 1024;
```

处理策略：

```txt
< 10MB:
  尝试富文本渲染

>= 10MB:
  默认纯文本预览，并提示用户
```

后续如果要增强，可以引入：

```txt
1. 读取进度
2. AbortController
3. Worker 文本提取
4. 空闲时间分片渲染
```

但不建议第一阶段就 Worker 化 `rtf.js`，因为 `rtf.js` 渲染过程产出 HTMLElement，天然依赖 DOM，Worker 化收益有限且改造成本高。

---

## 14. 支持矩阵更新建议

### README 支持类型

将：

```txt
RTF .rtf ✅ 文本提取预览
```

更新为：

```txt
RTF .rtf ✅ 基础富文本渲染，复杂内容降级为文本预览
```

### docs/user-facing-preview-support.md

将 RTF 行更新为：

```txt
| RTF | .rtf | 基础富文本渲染；复杂排版、嵌入对象或异常文件会降级为文本预览 |
```

### docs/preview-plugin-validation-matrix.md

建议新增测试项：

```txt
RTF basic text
RTF bold / italic / underline
RTF color / font size
RTF paragraph / line break
RTF table simple
RTF embedded image if available
RTF malformed file fallback
RTF large file fallback
Remote RTF URL with CORS
```

---

## 15. 测试用例建议

建议准备以下 fixtures：

```txt
public/samples/rtf/basic.rtf
public/samples/rtf/chinese.rtf
public/samples/rtf/styles.rtf
public/samples/rtf/table.rtf
public/samples/rtf/image.rtf
public/samples/rtf/malformed.rtf
```

测试点：

```txt
1. .rtf 文件可被 detectFileType 识别
2. rtfPlugin 能匹配 fileType === 'rtf'
3. adapter 使用动态 import，不把 rtf.js 打进主 bundle
4. 正常 RTF 显示 iframe
5. 损坏 RTF 降级为文本预览
6. 大文件触发文本降级
7. 远程 URL 读取失败时显示错误态
8. build:pages 通过
```

---

## 16. 推荐实施阶段

### Stage 18.1：RTF 富文本预览基础版

目标：

```txt
1. 新增 rtf.js + dompurify
2. 新增 RtfHtmlPreview
3. iframe sandbox 渲染
4. 保留文本 fallback
5. 更新支持矩阵和 README
```

验收：

```bash
bun run lint
bun run test:run
bun run build:pages
```

### Stage 18.2：体验优化

目标：

```txt
1. 加入大文件提示
2. 加入解析失败原因提示
3. 加入 sample RTF 文件
4. 增加预览 loading / error / fallback UI
```

### Stage 18.3：兼容性增强

目标：

```txt
1. 增强中文和 Unicode 转义处理
2. 增强简单表格样式
3. 收集 WMF / EMF 样例测试
4. 明确复杂对象 unsupported 文案
```

---

## 17. 对外能力描述

建议在 README 或用户文档中使用以下描述：

```txt
RTF 预览支持基础富文本渲染，包括常见文本、段落、字体样式、颜色和部分图片内容。
由于 RTF 格式历史较久且实现差异较多，复杂表格、页眉页脚、OLE 对象、公式、特殊嵌入对象和 Word 级分页效果不保证完整还原。
当富文本渲染失败时，FileVista 会自动降级为纯文本预览。
```

---

## 18. 最终建议

RTF 在 FileVista 中不应按“Office 高保真文档”定位，而应按“轻量富文本文件”定位。

推荐最终策略：

```txt
默认能力：
  rtf.js 富文本渲染

安全边界：
  DOMPurify + iframe sandbox + CSP

稳定性边界：
  渲染失败自动文本降级

产品承诺：
  支持基础富文本，不承诺 Word 级高保真

工程策略：
  按 rtf 插件懒加载，不进入主 bundle
```

这套方案最符合 FileVista 的纯前端定位，也能明显优于当前“仅文本提取预览”的能力。
