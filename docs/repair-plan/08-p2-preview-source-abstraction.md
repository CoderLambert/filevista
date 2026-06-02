# P2 - PreviewSource 输入源抽象

## 背景

当前 FileInfo 中的 `content` 同时存文本和 base64，`url` 存 object URL。这个结构能跑 Demo，但不利于性能和扩展。

## 目标

引入统一输入源：

```txt
File
Blob
ArrayBuffer
URL
```

## 涉及文件

```txt
src/components/file-preview/core/types.ts
src/components/file-preview/core/source.ts
src/components/file-preview/utils.ts
src/app/page.tsx
```

## 任务 1：新增 core/types.ts

```ts
export type PreviewSource =
  | {
      kind: "file";
      file: File;
    }
  | {
      kind: "blob";
      blob: Blob;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "arrayBuffer";
      buffer: ArrayBuffer;
      name?: string;
      mimeType?: string;
    }
  | {
      kind: "url";
      url: string;
      name?: string;
      mimeType?: string;
      headers?: Record<string, string>;
    };

export interface NormalizedFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  extension?: string;
  fileType: FileType;
  source: PreviewSource;
}
```

## 任务 2：新增 core/source.ts

```ts
export async function readSourceAsArrayBuffer(
  source: PreviewSource
): Promise<ArrayBuffer> {
  if (source.kind === "file") {
    return source.file.arrayBuffer();
  }

  if (source.kind === "blob") {
    return source.blob.arrayBuffer();
  }

  if (source.kind === "arrayBuffer") {
    return source.buffer;
  }

  if (source.kind === "url") {
    const response = await fetch(source.url, {
      headers: source.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  throw new Error("Unsupported source");
}

export async function readSourceAsText(
  source: PreviewSource
): Promise<string> {
  if (source.kind === "file") {
    return source.file.text();
  }

  if (source.kind === "blob") {
    return source.blob.text();
  }

  if (source.kind === "arrayBuffer") {
    return new TextDecoder("utf-8").decode(source.buffer);
  }

  if (source.kind === "url") {
    const response = await fetch(source.url, {
      headers: source.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch text: ${response.status}`);
    }

    return response.text();
  }

  throw new Error("Unsupported source");
}
```

## 任务 3：迁移策略

不要一次性移除旧 `FileInfo`。

分三步：

```txt
第一步：FileInfo 增加 source 字段，但保留 content / url
第二步：PDF / DOCX / PPTX / XLSX 优先改用 ArrayBuffer
第三步：最后移除 base64 content
```

## 任务 4：兼容旧组件

短期保留：

```ts
content: string | null;
url: string | null;
```

长期替换为：

```ts
source: PreviewSource;
objectUrl?: string;
```

## 验收标准

* 本地 File 可以预览
* Blob 可以预览
* ArrayBuffer 可以预览
* URL 可以预览
* PDF / DOCX / PPTX / XLSX 不再强依赖 base64
