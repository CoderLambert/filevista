# P0 - PDF worker 本地化与资源释放

## 背景

当前 PDF.js worker 依赖 CDN。该方式在内网、离线环境、严格 CSP 环境下容易失败。

## 涉及文件

```txt
src/components/file-preview/PdfPreview.tsx
package.json
scripts/copy-pdf-worker.mjs
public/vendor/pdfjs/pdf.worker.min.mjs
```

## 任务 1：新增 worker 复制脚本

新增：

```txt
scripts/copy-pdf-worker.mjs
```

内容：

```js
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const targetDir = path.resolve("public/vendor/pdfjs");
const targetPath = path.join(targetDir, "pdf.worker.min.mjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(workerPath, targetPath);

console.log(`Copied PDF.js worker to ${targetPath}`);
```

## 任务 2：修改 package.json

增加：

```json
{
  "scripts": {
    "postinstall": "node scripts/copy-pdf-worker.mjs"
  }
}
```

如果不想自动执行，也可以加独立命令：

```json
{
  "scripts": {
    "copy:pdf-worker": "node scripts/copy-pdf-worker.mjs"
  }
}
```

## 任务 3：修改 PdfPreview.tsx

替换：

```ts
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```

为：

```ts
pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
```

## 任务 4：补充 PDF cleanup

在 PDF 加载 effect 的 cleanup 中补充：

```ts
return () => {
  cancelled = true;

  const task = renderTaskRef.current as { cancel?: () => void } | null;
  try {
    task?.cancel?.();
  } catch {
    // ignore
  }

  const pdf = pdfDocRef.current as { destroy?: () => Promise<void> } | null;
  try {
    void pdf?.destroy?.();
  } catch {
    // ignore
  }

  renderTaskRef.current = null;
  pdfDocRef.current = null;
};
```

## 任务 5：抽最小类型

建议新增：

```ts
interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<unknown>;
  destroy?: () => Promise<void>;
}

interface PdfRenderTaskLike {
  promise: Promise<void>;
  cancel: () => void;
}
```

## 验收标准

* 断网后 PDF 仍能预览
* 内网环境下 PDF 仍能预览
* `/vendor/pdfjs/pdf.worker.min.mjs` 可以访问
* 快速切换 PDF 页面不报严重错误
* 清空文件后内存不持续上涨
