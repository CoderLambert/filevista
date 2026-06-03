可以。下面给你一份**可直接落地的完整实现**，按照“多信号生产级轻量方案”来做：

```txt
文件名来源解析
+ Content-Type 响应头
+ 泛化 MIME 降权
+ Magic Number 基础识别
+ ZIP 容器识别 docx / pptx / xlsx / epub
+ 统一转 FileInfo
+ 复用现有 Legacy Renderer / Plugin Renderer
```

---

# 1. 新增文件

新增：

```txt
src/components/file-preview/remote-url.ts
```

完整内容如下：

```ts
import { detectFileType, generateId } from "./utils";
import type { FileInfo, FileType } from "./utils";

type FileNameSource =
  | "content-disposition"
  | "query"
  | "pathname"
  | "fallback";

type MimeDetectionSource =
  | "container"
  | "magic"
  | "extension"
  | "header"
  | "fallback";

interface FileNameResult {
  fileName: string;
  source: FileNameSource;
}

interface MimeResult {
  mimeType: string;
  source: MimeDetectionSource;
}

interface MagicSniffResult {
  ext: string | null;
  mimeType: string | null;
}

interface ContainerSniffResult {
  ext: string;
  mimeType: string;
}

const REMOTE_MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",

  pdf: "application/pdf",
  zip: "application/zip",
  epub: "application/epub+zip",

  json: "application/json",
  csv: "text/csv",
  md: "text/markdown",
  mdx: "text/markdown",
  html: "text/html",
  htm: "text/html",
  svg: "image/svg+xml",

  txt: "text/plain",
  log: "text/plain",

  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",

  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",

  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
};

const GENERIC_MIME_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-msdownload",
  "application/download",
]);

const BASE64_FILE_TYPES = new Set<FileType>([
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "zip",
  "epub",
]);

const OBJECT_URL_FILE_TYPES = new Set<FileType>([
  "image",
  "video",
  "audio",
]);

function sanitizeRemoteFileName(fileName: string): string {
  const cleanName = fileName
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName || "remote-file";
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getExtension(fileName: string): string {
  const cleanName = fileName.split("?")[0].split("#")[0];
  const parts = cleanName.toLowerCase().split(".");

  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function normalizeHeaderMimeType(headerMimeType: string): string {
  const mimeType = headerMimeType.split(";")[0]?.trim().toLowerCase() || "";

  return GENERIC_MIME_TYPES.has(mimeType) ? "" : mimeType;
}

function getHeaderMimeType(response: Response): string {
  return response.headers.get("content-type")?.split(";")[0]?.trim() || "";
}

function getFileNameFromContentDisposition(
  contentDisposition?: string | null
): string | null {
  if (!contentDisposition) return null;

  const filenameStarMatch = contentDisposition.match(
    /filename\*\s*=\s*([^;]+)/i
  );

  if (filenameStarMatch?.[1]) {
    const rawValue = stripQuotes(filenameStarMatch[1]);

    const utf8PrefixMatch = rawValue.match(/^UTF-8''(.+)$/i);
    const encodedValue = utf8PrefixMatch?.[1] || rawValue;

    return sanitizeRemoteFileName(tryDecodeURIComponent(encodedValue));
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);

  if (filenameMatch?.[1]) {
    return sanitizeRemoteFileName(
      tryDecodeURIComponent(stripQuotes(filenameMatch[1]))
    );
  }

  return null;
}

function getRemoteFileName(
  rawUrl: string,
  contentDisposition?: string | null
): FileNameResult {
  const fromDisposition = getFileNameFromContentDisposition(contentDisposition);

  if (fromDisposition) {
    return {
      fileName: fromDisposition,
      source: "content-disposition",
    };
  }

  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;

    const queryKeys = [
      "showname",
      "filename",
      "fileName",
      "name",
      "file",
      "download",
    ];

    let firstQueryCandidate: string | null = null;

    for (const key of queryKeys) {
      const value = params.get(key)?.trim();

      if (!value || value.toLowerCase() === "true") {
        continue;
      }

      const candidate = sanitizeRemoteFileName(value);

      if (!firstQueryCandidate) {
        firstQueryCandidate = candidate;
      }

      if (getExtension(candidate)) {
        return {
          fileName: candidate,
          source: "query",
        };
      }
    }

    const pathname = decodeURIComponent(url.pathname);
    const pathnameName = pathname.split("/").filter(Boolean).pop();

    if (pathnameName?.trim()) {
      const candidate = sanitizeRemoteFileName(pathnameName.trim());

      if (getExtension(candidate)) {
        return {
          fileName: candidate,
          source: "pathname",
        };
      }
    }

    if (firstQueryCandidate) {
      return {
        fileName: firstQueryCandidate,
        source: "query",
      };
    }

    if (pathnameName?.trim()) {
      return {
        fileName: sanitizeRemoteFileName(pathnameName.trim()),
        source: "pathname",
      };
    }

    return {
      fileName: "remote-file",
      source: "fallback",
    };
  } catch {
    return {
      fileName: "remote-file",
      source: "fallback",
    };
  }
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;

  return signature.every((value, index) => bytes[index] === value);
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function sniffMagic(buffer: ArrayBuffer): MagicSniffResult {
  const bytes = new Uint8Array(buffer.slice(0, 32));

  // PDF: %PDF-
  if (readAscii(bytes, 0, 5) === "%PDF-") {
    return {
      ext: "pdf",
      mimeType: "application/pdf",
    };
  }

  // ZIP: PK\x03\x04 / PK\x05\x06 / PK\x07\x08
  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return {
      ext: "zip",
      mimeType: "application/zip",
    };
  }

  // PNG
  if (
    startsWithBytes(bytes, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  ) {
    return {
      ext: "png",
      mimeType: "image/png",
    };
  }

  // JPG
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return {
      ext: "jpg",
      mimeType: "image/jpeg",
    };
  }

  // GIF
  const gifHeader = readAscii(bytes, 0, 6);

  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return {
      ext: "gif",
      mimeType: "image/gif",
    };
  }

  // WEBP: RIFF....WEBP
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return {
      ext: "webp",
      mimeType: "image/webp",
    };
  }

  // MP4: ....ftyp
  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    return {
      ext: "mp4",
      mimeType: "video/mp4",
    };
  }

  // Old Office / OLE Compound File Binary
  if (
    startsWithBytes(bytes, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ])
  ) {
    return {
      ext: "ole",
      mimeType: "application/x-ole-storage",
    };
  }

  return {
    ext: null,
    mimeType: null,
  };
}

async function sniffZipContainer(
  buffer: ArrayBuffer
): Promise<ContainerSniffResult | null> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);

    const fileNames = Object.keys(zip.files).map((name) =>
      name.replace(/\\/g, "/").toLowerCase()
    );

    const hasFile = (target: string) => fileNames.includes(target);

    if (hasFile("word/document.xml")) {
      return {
        ext: "docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }

    if (hasFile("ppt/presentation.xml")) {
      return {
        ext: "pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    }

    if (hasFile("xl/workbook.xml")) {
      return {
        ext: "xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    const mimetypeFile = zip.file("mimetype");

    if (mimetypeFile) {
      const mimetype = (await mimetypeFile.async("string")).trim();

      if (mimetype === "application/epub+zip") {
        return {
          ext: "epub",
          mimeType: "application/epub+zip",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function resolveRemoteMimeType(input: {
  fileName: string;
  headerMimeType: string;
  magicMimeType: string | null;
  containerMimeType: string | null;
}): MimeResult {
  const ext = getExtension(input.fileName);
  const mimeFromExtension = REMOTE_MIME_BY_EXTENSION[ext];
  const mimeFromHeader = normalizeHeaderMimeType(input.headerMimeType);

  if (input.containerMimeType) {
    return {
      mimeType: input.containerMimeType,
      source: "container",
    };
  }

  if (input.magicMimeType && input.magicMimeType !== "application/zip") {
    return {
      mimeType: input.magicMimeType,
      source: "magic",
    };
  }

  if (mimeFromExtension) {
    return {
      mimeType: mimeFromExtension,
      source: "extension",
    };
  }

  if (mimeFromHeader) {
    return {
      mimeType: mimeFromHeader,
      source: "header",
    };
  }

  if (input.magicMimeType) {
    return {
      mimeType: input.magicMimeType,
      source: "magic",
    };
  }

  return {
    mimeType: "application/octet-stream",
    source: "fallback",
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function shouldDecodeAsText(fileType: FileType, mimeType: string): boolean {
  if (fileType === "unknown") return false;

  return (
    fileType === "text" ||
    fileType === "markdown" ||
    fileType === "json" ||
    fileType === "code" ||
    fileType === "csv" ||
    fileType === "html" ||
    fileType === "svg" ||
    fileType === "rtf" ||
    mimeType.startsWith("text/")
  );
}

function getRemoteLoadErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "无法加载远程文件。可能是 URL 不可访问，或目标服务器未允许浏览器跨域访问。";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load remote URL";
}

export async function processRemoteUrl(rawUrl: string): Promise<FileInfo> {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl) {
    throw new Error("Remote URL is empty");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error("Please enter a valid URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }

  let response: Response;

  try {
    response = await fetch(parsedUrl.toString());
  } catch (error) {
    throw new Error(getRemoteLoadErrorMessage(error));
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch remote file: ${response.status}`);
  }

  const headerMimeType = getHeaderMimeType(response);
  const contentDisposition = response.headers.get("content-disposition");

  const fileNameResult = getRemoteFileName(
    parsedUrl.toString(),
    contentDisposition
  );

  const buffer = await response.arrayBuffer();

  const magicResult = sniffMagic(buffer);

  const containerResult =
    magicResult.ext === "zip" ? await sniffZipContainer(buffer) : null;

  const mimeResult = resolveRemoteMimeType({
    fileName: fileNameResult.fileName,
    headerMimeType,
    magicMimeType: magicResult.mimeType,
    containerMimeType: containerResult?.mimeType ?? null,
  });

  const fileType = detectFileType(fileNameResult.fileName, mimeResult.mimeType);

  let content: string | null = null;
  let objectUrl: string | null = null;

  if (BASE64_FILE_TYPES.has(fileType)) {
    content = arrayBufferToBase64(buffer);
  } else if (OBJECT_URL_FILE_TYPES.has(fileType)) {
    const blob = new Blob([buffer], { type: mimeResult.mimeType });
    objectUrl = URL.createObjectURL(blob);
  } else if (shouldDecodeAsText(fileType, mimeResult.mimeType)) {
    content = new TextDecoder("utf-8").decode(buffer);
  }

  return {
    id: generateId(),
    name: fileNameResult.fileName,
    size: buffer.byteLength,
    type: mimeResult.mimeType,
    fileType,
    content,
    url: objectUrl,
    source: {
      kind: "arrayBuffer",
      buffer,
      name: fileNameResult.fileName,
      mimeType: mimeResult.mimeType,
    },
  };
}
```

---

# 2. 修改 `src/app/page.tsx`

## 2.1 修改 import

原来：

```ts
import {
  Upload,
  FileText,
  X,
  Eye,
  Trash2,
  File,
  FolderOpen,
  Sparkles,
  Github,
  BookOpen,
} from "lucide-react";
```

改成：

```ts
import {
  Upload,
  FileText,
  X,
  Eye,
  Trash2,
  File,
  FolderOpen,
  Sparkles,
  Github,
  BookOpen,
  Link2,
} from "lucide-react";
```

再新增：

```ts
import { processRemoteUrl } from "@/components/file-preview/remote-url";
```

---

## 2.2 新增状态

在 `Home()` 里：

```ts
const [files, setFiles] = useState<FileInfo[]>([]);
const [activeFileId, setActiveFileId] = useState<string | null>(null);
const [previewEngine, setPreviewEngine] = useState<"legacy" | "plugin">("legacy");
const [isDragOver, setIsDragOver] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

后面加：

```ts
const [remoteUrl, setRemoteUrl] = useState("");
const [loadingRemoteUrl, setLoadingRemoteUrl] = useState(false);
```

---

## 2.3 新增 `loadRemoteUrl`

放在 `loadDemoFiles` 附近即可：

```ts
const loadRemoteUrl = useCallback(async () => {
  if (!remoteUrl.trim()) {
    toast.error("Remote URL is empty");
    return;
  }

  setLoadingRemoteUrl(true);

  try {
    const info = await processRemoteUrl(remoteUrl);

    setFiles((prev) => [...prev, info]);
    setActiveFileId(info.id);
    setRemoteUrl("");

    toast.success(`Loaded remote file: ${info.name}`);
  } catch (err) {
    console.error("Failed to load remote URL:", err);

    const message =
      err instanceof Error ? err.message : "Failed to load remote URL";

    toast.error(message);
  } finally {
    setLoadingRemoteUrl(false);
  }
}, [remoteUrl]);
```

---

## 2.4 修改左侧 Sidebar 上传区域

找到：

```tsx
<div className="p-3 border-b">
  <Button
    variant="outline"
    className="w-full gap-2 h-10 border-dashed"
    onClick={() => fileInputRef.current?.click()}
  >
    <FolderOpen className="h-4 w-4" />
    Select Files / 浏览文件
  </Button>
  <input
    ref={fileInputRef}
    type="file"
    multiple
    className="hidden"
    onChange={handleFileInput}
    accept="*"
  />
</div>
```

替换成：

```tsx
<div className="p-3 border-b space-y-2">
  <Button
    variant="outline"
    className="w-full gap-2 h-10 border-dashed"
    onClick={() => fileInputRef.current?.click()}
  >
    <FolderOpen className="h-4 w-4" />
    Select Files / 浏览文件
  </Button>

  <input
    ref={fileInputRef}
    type="file"
    multiple
    className="hidden"
    onChange={handleFileInput}
    accept="*"
  />

  <div className="flex gap-2">
    <input
      value={remoteUrl}
      onChange={(e) => setRemoteUrl(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          loadRemoteUrl();
        }
      }}
      placeholder="Paste remote file URL"
      className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
    />

    <Button
      variant="outline"
      size="sm"
      onClick={loadRemoteUrl}
      disabled={loadingRemoteUrl || !remoteUrl.trim()}
      className="h-9 shrink-0 gap-1.5 text-xs"
    >
      {loadingRemoteUrl ? (
        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      URL
    </Button>
  </div>

  <p className="text-[10px] text-muted-foreground leading-relaxed">
    Supports remote URLs when the target server allows browser CORS.
  </p>
</div>
```

---

# 3. README 修改建议

## 3.1 项目简介改成

```md
FileVista 是一个纯浏览器端文件预览工具集，基于 Next.js、React、TypeScript 和插件化 Preview Renderer 构建。支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等），预览内核支持 File / Blob / ArrayBuffer / URL 等数据源，当前公开 Demo 支持本地文件上传和可跨域访问的远程 URL 预览。所有处理均在浏览器内完成，文件不会上传服务器。
```

## 3.2 Features 增加

```md
- 支持本地文件上传，也支持可跨域访问的远程 URL 预览
- 预览内核支持 File / Blob / ArrayBuffer / URL 等数据源
```

## 3.3 当前限制增加

```md
- 远程 URL 预览依赖目标服务器 CORS 配置，若目标服务器未允许浏览器跨域访问，则无法直接预览
```

---

# 4. `docs/user-facing-preview-support.md` 增加

````md
## Remote URL Preview

FileVista supports remote file URL preview when the target server allows browser-side cross-origin access.

Supported examples:

```txt
https://example.com/file.pdf
https://example.com/file.docx
https://example.com/file.xlsx
````

Download-style URLs are also supported when the filename can be resolved from query parameters or response headers:

```txt
https://example.com/download?showname=demo.docx&filename=xxx.docx
```

If a remote URL fails to load, possible reasons include:

```txt
1. The URL is invalid
2. The file is not publicly accessible
3. The target server does not allow browser CORS access
4. The file type is unsupported
```

````

---

# 5. `docs/github-pages-release-checklist.md` 增加

```md
## Check Remote URL Preview

Paste a remote DOCX URL:

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
````

Also test a download-style URL:

```txt
https://www.cnipa.gov.cn/module/download/downfile.jsp?classid=0&showname=3%EF%BC%8E%E6%8E%A8%E8%8D%90%E5%87%BD.docx&filename=d79c1d6677e845d0a9d3d6ebe9e5d632.docx
```

Expected:

```txt
Remote file loads successfully when CORS is allowed
DOCX file is detected correctly
Download-style URL uses showname / filename instead of downfile.jsp
Plugin Renderer can render it through builtin.docx
A clear error is shown when CORS is blocked
```

````

---

# 6. 验证方式

本地执行：

```bash
bun run lint
bun run test:run
bun run build
bun run build:pages
````

或者：

```bash
bun run check
bun run build:pages
```

手动测试：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

预期：

```txt
文件名：WHONET_for_GLASS.Chinese.docx
fileType：docx
Plugin Renderer：builtin.docx
```

再测试下载接口：

```txt
https://www.cnipa.gov.cn/module/download/downfile.jsp?classid=0&showname=3%EF%BC%8E%E6%8E%A8%E8%8D%90%E5%87%BD.docx&filename=d79c1d6677e845d0a9d3d6ebe9e5d632.docx
```

预期：

```txt
文件名：3．推荐函.docx
fileType：docx
不是 downfile.jsp
```

---

# 7. 推荐提交

```bash
git add src/components/file-preview/remote-url.ts
git add src/app/page.tsx
git add README.md
git add docs/user-facing-preview-support.md
git add docs/github-pages-release-checklist.md

git commit -m "feat: support remote file URL preview"
git push
```

---

这个实现的判断链路是：

```txt
Content-Disposition / query / pathname
→ 文件名
→ 扩展名 MIME Map
→ Content-Type 辅助
→ Magic Number
→ ZIP 容器识别
→ FileInfo
→ Renderer
```

比单纯 `Content-Type` 或扩展名判断稳很多。
