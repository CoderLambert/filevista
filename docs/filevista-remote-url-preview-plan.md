# FileVista Remote URL Preview 实现方案

## 1. 背景

FileVista 当前已经完成 Stage 17：发布态体验与文档完善，项目已经具备：

```txt
1. Plugin Renderer 支持主流文件类型
2. 支持状态矩阵已经显式化
3. Vitest 已覆盖 registry、support-status、UnsupportedPluginPreview、LargeFileHint
4. GitHub Actions 已自动执行 lint / test / build
5. GitHub Pages 已自动部署
6. README、用户支持矩阵、Plugin 开发指南、Pages 发布检查清单已建立
```

在 Stage 17 的 README 中，FileVista 已经明确说明：

```txt
预览内核支持 File / Blob / ArrayBuffer / URL 等数据源
当前公开 Demo 以本地文件上传与预览为主
```

当前项目内部已经存在 `PreviewSource` 抽象，并且支持：

```ts
type PreviewSource =
  | { kind: "file"; file: File }
  | { kind: "blob"; blob: Blob; name?: string; mimeType?: string }
  | { kind: "arrayBuffer"; buffer: ArrayBuffer; name?: string; mimeType?: string }
  | { kind: "url"; url: string; name?: string; mimeType?: string; headers?: Record<string, string> };
```

同时 `readSourceAsArrayBuffer()` 已经支持 `source.kind === "url"`，能够通过 `fetch(source.url)` 获取远程文件内容。

但当前首页还没有远程 URL 输入入口，因此用户无法直接粘贴一个远程文件地址进行预览。

本阶段目标是补齐这个入口，使用户可以直接输入远程文件 URL，例如：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

然后 FileVista 直接在浏览器中拉取并预览该远程 DOCX 文件。

---

## 2. 阶段命名

建议将本次增强作为 Stage 17 后的一个小阶段：

```txt
Stage 17.1：Remote URL Preview
```

也可以作为 Stage 18 前置能力：

```txt
Stage 17.1：远程 URL 文件预览入口
```

本阶段仍然属于发布态体验增强，不进入大文件性能优化，不重构 Plugin Renderer。

---

## 3. 核心目标

本阶段目标：

```txt
1. 首页增加远程 URL 输入框
2. 支持用户粘贴远程文件 URL
3. 自动解析远程 URL 的文件名
4. 自动推断文件类型
5. 自动拉取远程文件内容
6. 将远程文件转换为 FileInfo
7. 复用现有 Legacy Renderer / Plugin Renderer
8. 对 CORS、URL 错误、加载失败给出清晰提示
9. 文档中明确远程 URL 预览的能力和限制
```

---

## 4. 不做内容

本阶段不做：

```txt
不新增后端服务
不新增代理服务器
不绕过浏览器 CORS 限制
不改 Plugin Registry
不新增文件类型
不重构 PreviewSource
不重构 Office / PDF / ZIP / EPUB 解析逻辑
不引入大型依赖
不改变 GitHub Pages 部署架构
```

---

## 5. 用户故事

### 5.1 用户粘贴远程 DOCX URL

用户输入：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

点击：

```txt
Preview URL
```

系统行为：

```txt
1. 校验 URL 是否为 http / https
2. 从 pathname 中解析文件名 WHONET_for_GLASS.Chinese.docx
3. 根据 .docx 扩展名推断 MIME
4. fetch 远程文件
5. 转换为 ArrayBuffer
6. 构造 FileInfo
7. 加入左侧文件列表
8. 自动选中该文件
9. 使用当前 Renderer 进行预览
```

预期结果：

```txt
远程 DOCX 文件可以正常展示
```

### 5.2 用户输入无效 URL

用户输入：

```txt
abc
```

预期结果：

```txt
提示：Please enter a valid http/https URL
```

### 5.3 目标站点阻止 CORS

用户输入一个不允许跨域访问的文件 URL。

预期结果：

```txt
提示：无法加载远程文件，可能是 URL 不可访问，或目标服务器未允许浏览器跨域访问。
```

### 5.4 远程文件无法识别类型

用户输入一个没有扩展名、且响应头也没有有效 MIME 的 URL。

预期结果：

```txt
文件加入列表，但 fileType 为 unknown
预览区域显示 Preview Not Available
```

---

## 6. 技术方案选择

### 6.1 可选方案 A：直接使用 `source.kind = "url"`

思路：

```ts
source: {
  kind: "url",
  url,
  name,
  mimeType,
}
```

优点：

```txt
1. 代码最少
2. 符合 PreviewSource 抽象
3. 由各 Preview 组件按需 fetch
```

缺点：

```txt
1. 渲染阶段会二次请求远程 URL
2. 无法提前知道文件大小
3. 错误出现在 Preview 组件内部，用户反馈不够统一
4. 多个 Preview 组件可能重复 fetch
5. 网络波动会导致渲染阶段失败
```

### 6.2 推荐方案 B：先 fetch，再转为 ArrayBuffer

思路：

```txt
URL → fetch → ArrayBuffer → FileInfo.source.kind = "arrayBuffer"
```

优点：

```txt
1. 加载远程文件时就能统一处理错误
2. 可以拿到文件大小
3. 可以复用现有 FileInfo 结构
4. 可以同时兼容 Legacy Renderer 的 content 字段
5. Preview 阶段不再重复请求 URL
6. 对 DOCX / PDF / PPTX / XLSX / ZIP / EPUB 更稳定
```

缺点：

```txt
1. 初次加载会把完整文件读入内存
2. 大文件可能有等待时间
3. 后续 Stage 18 仍需要补充加载进度和取消机制
```

本阶段推荐使用方案 B。

---

## 7. 实现文件

本次建议修改：

```txt
src/app/page.tsx
README.md
docs/user-facing-preview-support.md
docs/github-pages-release-checklist.md
```

可选新增：

```txt
docs/remote-url-preview.md
```

如果希望把工具函数从 `page.tsx` 拆出去，可以新增：

```txt
src/components/file-preview/remote-url.ts
```

但本阶段为了减少改动范围，建议先把少量工具函数放在 `src/app/page.tsx` 中。

---

## 8. 关键实现细节

## 8.1 新增状态

在 `Home()` 中增加：

```tsx
const [remoteUrl, setRemoteUrl] = useState("");
const [loadingRemoteUrl, setLoadingRemoteUrl] = useState(false);
```

用途：

```txt
remoteUrl：保存用户输入的远程文件地址
loadingRemoteUrl：远程文件加载中的按钮状态
```

---

## 8.2 URL 文件名解析

新增函数：

```tsx
function getFileNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const pathname = decodeURIComponent(url.pathname);
    const name = pathname.split("/").filter(Boolean).pop();

    return name || "remote-file";
  } catch {
    return "remote-file";
  }
}
```

示例：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

解析结果：

```txt
WHONET_for_GLASS.Chinese.docx
```

注意：

```txt
1. 需要 decodeURIComponent
2. URL path 中可能包含中文文件名
3. query 参数不应该作为文件名的一部分
4. 如果解析失败，回退为 remote-file
```

---

## 8.3 远程 MIME 修正

远程服务器可能返回：

```txt
application/octet-stream
binary/octet-stream
text/plain
```

甚至没有 `Content-Type`。

因此不能完全依赖响应头，需要优先根据 URL 文件名推断 MIME。

新增函数：

```tsx
function normalizeRemoteMimeType(fileName: string, responseMimeType: string): string {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (lowerName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  if (lowerName.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (lowerName.endsWith(".doc")) {
    return "application/msword";
  }

  if (lowerName.endsWith(".ppt")) {
    return "application/vnd.ms-powerpoint";
  }

  if (lowerName.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }

  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerName.endsWith(".epub")) {
    return "application/epub+zip";
  }

  if (lowerName.endsWith(".zip")) {
    return "application/zip";
  }

  if (lowerName.endsWith(".csv")) {
    return "text/csv";
  }

  if (lowerName.endsWith(".md") || lowerName.endsWith(".mdx")) {
    return "text/markdown";
  }

  if (lowerName.endsWith(".json")) {
    return "application/json";
  }

  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
    return "text/html";
  }

  if (lowerName.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return responseMimeType || "application/octet-stream";
}
```

原因：

```txt
detectFileType(filename, mimeType) 既依赖文件扩展名，也依赖 MIME。
但远程 URL 的 MIME 经常不可靠，所以需要先修正。
```

---

## 8.4 ArrayBuffer 转 Base64

当前 `processFile()` 对 PDF / DOCX / PPTX / XLSX / ZIP / EPUB 等二进制文件会生成 base64 的 `content` 字段。

为了兼容 Legacy Renderer 和已有 Preview 组件，远程 URL 也建议生成 `content`。

新增函数：

```tsx
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
```

注意：

```txt
不能直接对超大 Uint8Array 使用 String.fromCharCode(...bytes)
否则容易触发 Maximum call stack size exceeded
需要按 chunk 分段处理
```

---

## 8.5 远程 URL 转 FileInfo

核心函数：

```tsx
async function processRemoteUrl(rawUrl: string): Promise<FileInfo> {
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

  const response = await fetch(parsedUrl.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch remote file: ${response.status}`);
  }

  const fileName = getFileNameFromUrl(parsedUrl.toString());
  const responseMimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "";

  const mimeType = normalizeRemoteMimeType(fileName, responseMimeType);
  const fileType = detectFileType(fileName, mimeType);

  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;

  const needsBase64 = [
    "pdf",
    "docx",
    "doc",
    "pptx",
    "ppt",
    "xlsx",
    "xls",
    "zip",
    "epub",
  ].includes(fileType);

  const needsObjectUrl = ["image", "video", "audio"].includes(fileType);

  let content: string | null = null;
  let objectUrl: string | null = null;

  if (needsBase64) {
    content = arrayBufferToBase64(buffer);
  } else if (needsObjectUrl) {
    const blob = new Blob([buffer], { type: mimeType });
    objectUrl = URL.createObjectURL(blob);
  } else {
    content = new TextDecoder("utf-8").decode(buffer);
  }

  return {
    id: generateId(),
    name: fileName,
    size,
    type: mimeType,
    fileType,
    content,
    url: objectUrl,
    source: {
      kind: "arrayBuffer",
      buffer,
      name: fileName,
      mimeType,
    },
  };
}
```

---

## 8.6 加载远程 URL

在 `Home()` 中新增：

```tsx
const loadRemoteUrl = useCallback(async () => {
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
      err instanceof Error
        ? err.message
        : "Failed to load remote URL";

    toast.error(
      message.includes("Failed to fetch")
        ? "无法加载远程文件。可能是 URL 不可访问，或目标服务器未允许浏览器跨域访问。"
        : message
    );
  } finally {
    setLoadingRemoteUrl(false);
  }
}, [remoteUrl]);
```

---

## 8.7 回车触发加载

输入框建议支持回车：

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter") {
    loadRemoteUrl();
  }
}}
```

---

## 8.8 UI 放置位置

建议放在 Sidebar 文件选择按钮下方。

原位置：

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
  <input ... />
</div>
```

改为：

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
      className="h-9 shrink-0 text-xs"
    >
      {loadingRemoteUrl ? "Loading" : "URL"}
    </Button>
  </div>

  <p className="text-[10px] text-muted-foreground leading-relaxed">
    Supports remote URLs when the target server allows browser CORS.
  </p>
</div>
```

---

## 9. 示例 URL 验证

测试 URL：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

预期链路：

```txt
1. 输入 URL
2. getFileNameFromUrl() 得到 WHONET_for_GLASS.Chinese.docx
3. normalizeRemoteMimeType() 得到 DOCX MIME
4. detectFileType() 得到 docx
5. fetch() 获取远程 ArrayBuffer
6. 构造 FileInfo
7. source.kind = arrayBuffer
8. Plugin Renderer 命中 builtin.docx
9. DocxPreview 调用 readBinaryPreviewAsArrayBuffer()
10. docx-preview 渲染文档
```

预期结果：

```txt
远程 DOCX 文件可直接预览
```

---

## 10. CORS 限制说明

远程 URL 预览是纯浏览器端能力，因此受到浏览器 CORS 限制。

如果目标服务器没有返回允许跨域访问的响应头，浏览器会阻止请求。

典型错误：

```txt
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

FileVista 不能在纯 GitHub Pages 环境中绕过这个限制。

因此文档中必须明确：

```txt
远程 URL 预览只适用于允许浏览器跨域访问的远程文件。
如果目标服务器未开放 CORS，FileVista 会显示加载失败提示。
```

不建议写：

```txt
支持所有远程 URL
可以预览任意公网文件
可以绕过跨域限制
```

---

## 11. README 更新建议

### 11.1 项目简介

当前：

```md
预览内核支持本地 File/Blob/ArrayBuffer 等数据源，当前公开 Demo 以本地文件上传与预览为主。
```

建议改为：

```md
预览内核支持 File / Blob / ArrayBuffer / URL 等数据源，当前公开 Demo 支持本地文件上传和可跨域访问的远程 URL 预览。
```

### 11.2 Features

新增或修改为：

```md
- 支持本地文件上传，也支持可跨域访问的远程 URL 预览
- 预览内核支持 File / Blob / ArrayBuffer / URL 等数据源
```

### 11.3 当前限制

新增：

```md
- 远程 URL 预览依赖目标服务器 CORS 配置，若目标服务器未允许浏览器跨域访问，则无法直接预览
```

---

## 12. 用户支持矩阵更新建议

修改：

```txt
docs/user-facing-preview-support.md
```

新增：

```md
## Remote URL Preview

FileVista supports remote file URL preview when the target server allows browser-side cross-origin access.

Supported examples:

```txt
https://example.com/file.pdf
https://example.com/file.docx
https://example.com/file.xlsx
```

If a remote URL fails to load, possible reasons include:

```txt
1. The URL is invalid
2. The file is not publicly accessible
3. The target server does not allow browser CORS access
4. The file type is unsupported
```
```

---

## 13. GitHub Pages 检查清单更新建议

修改：

```txt
docs/github-pages-release-checklist.md
```

新增：

```md
## Check Remote URL Preview

Paste a remote DOCX URL:

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

Expected:

```txt
Remote file loads successfully when CORS is allowed
DOCX file is detected correctly
Plugin Renderer can render it through builtin.docx
A clear error is shown when CORS is blocked
```
```

---

## 14. 测试建议

### 14.1 本地手动测试

启动：

```bash
bun run dev
```

测试：

```txt
1. 粘贴 https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
2. 点击 URL
3. 检查文件是否加入左侧列表
4. 检查文件名是否为 WHONET_for_GLASS.Chinese.docx
5. 检查类型是否识别为 Word / docx
6. 切换 Plugin Renderer
7. 检查文档是否正常渲染
```

### 14.2 GitHub Pages 测试

部署后访问：

```txt
https://coderlambert.github.io/filevista/
```

测试同样 URL：

```txt
https://whonet.org/Docs/WHONET_for_GLASS.Chinese.docx
```

预期：

```txt
如果目标站点允许 GitHub Pages origin 跨域访问，则正常加载
如果 CORS 阻止，则显示清晰错误提示
```

### 14.3 不支持 URL 测试

测试：

```txt
ftp://example.com/file.docx
```

预期：

```txt
Only http/https URLs are supported
```

测试：

```txt
abc
```

预期：

```txt
Please enter a valid URL
```

测试：

```txt
https://example.com/not-found.docx
```

预期：

```txt
Failed to fetch remote file: 404
```

---

## 15. 潜在风险

### 15.1 CORS 风险

最大风险是目标服务器不允许跨域访问。

处理方式：

```txt
1. 文档中明确说明限制
2. UI 中增加简短提示
3. toast 中给出明确错误原因
```

### 15.2 大文件内存风险

远程 URL 当前会完整拉取为 ArrayBuffer。

风险：

```txt
1. 大文件会占用内存
2. 大文件加载没有进度条
3. 用户无法取消加载
```

处理方式：

```txt
本阶段接受该限制
Stage 18 再做加载进度、AbortController、大小限制和 Worker 化
```

### 15.3 MIME 不准确

远程响应头可能不准确。

处理方式：

```txt
优先使用 URL 文件扩展名推断
MIME 仅作为辅助判断
```

### 15.4 非标准下载 URL

有些 URL 不包含文件扩展名，例如：

```txt
https://example.com/download?id=123
```

如果响应头没有准确 MIME，可能识别为 unknown。

本阶段暂不处理复杂 Content-Disposition 解析。

后续可支持：

```txt
Content-Disposition: attachment; filename="demo.docx"
```

---

## 16. 后续优化方向

Stage 18 可继续增强：

```txt
1. AbortController 支持取消远程 URL 加载
2. 远程文件加载进度条
3. 远程文件大小限制
4. 读取 Content-Length 显示预计大小
5. 支持 Content-Disposition 文件名解析
6. 支持 URL 历史记录
7. 支持 URL 预览失败时提供下载链接
8. 支持以 source.kind = "url" 的懒加载模式
9. 支持代理模式，但需要后端服务，不适合 GitHub Pages
```

---

## 17. 推荐提交

```bash
git add src/app/page.tsx
git add README.md
git add docs/user-facing-preview-support.md
git add docs/github-pages-release-checklist.md

git commit -m "feat: support remote file URL preview"
git push
```

---

## 18. 验收标准

完成后需要满足：

```txt
1. 首页出现远程 URL 输入框
2. 用户可以粘贴 http / https 文件 URL
3. 非 http / https URL 会被拒绝
4. 无效 URL 会显示错误提示
5. 远程 DOCX URL 可以解析出正确文件名
6. 远程 DOCX URL 可以识别为 docx
7. 成功加载后文件进入左侧文件列表
8. 成功加载后自动选中远程文件
9. Plugin Renderer 可以复用 builtin.docx
10. Legacy Renderer 仍保持兼容
11. image / video / audio 远程 URL 能生成 object URL
12. PDF / DOCX / PPTX / XLSX / ZIP / EPUB 能生成 base64 content
13. CORS 失败时有明确提示
14. README 更新远程 URL 能力说明
15. 用户支持矩阵补充 Remote URL Preview
16. GitHub Pages checklist 补充远程 URL 检查
17. bun run check 通过
18. bun run build:pages 通过
19. GitHub Actions CI 通过
20. GitHub Pages Deploy 通过
```

---

## 19. 阶段结论

本次远程 URL 预览是 FileVista 发布态体验的重要补强。

完成后，FileVista 将支持：

```txt
1. 本地文件上传预览
2. 内置 Demo 文件预览
3. 可跨域访问的远程 URL 文件预览
```

对于用户来说，FileVista 的定位会更完整：

```txt
纯浏览器端文件预览工具
文件不上传服务器
支持本地文件和远程文件 URL
```

对于架构来说，本次实现仍然复用现有：

```txt
FileInfo
PreviewSource
detectFileType
Legacy Renderer
Plugin Renderer
Preview Adapter
support-status
```

不会破坏 Stage 14-17 已经收口的 Plugin Renderer 架构。
