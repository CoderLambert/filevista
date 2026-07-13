# FileVista

[English](README.md) | 简体中文

FileVista 是一个纯浏览器端文件预览工具集，基于 Next.js、React、TypeScript 和插件化 Preview Renderer 构建。支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等），预览内核支持 File / Blob / ArrayBuffer / URL 等数据源，当前公开 Demo 支持本地文件上传和可跨域访问的远程 URL 预览。所有处理均在浏览器内完成，文件不会上传服务器。

在线 Demo：

https://coderlambert.github.io/filevista/

## 这个仓库包含什么

- `@lamberl-lee/file-preview`：可发布到 npm 的 React 文件预览库，代码在 [packages/file-preview](packages/file-preview)。
- Playground Demo：在线演示和本地调试应用，代码在 [apps/playground](apps/playground)。
- 文档与验证资产：支持矩阵、插件开发指南、GitHub Pages 发布清单等，代码在 [docs](docs)。

## Features

- 支持本地文件上传，也支持可跨域访问的远程 URL 预览
- 预览内核支持 File / Blob / ArrayBuffer / URL 等数据源
- 拖拽上传、多文件切换、TabCache 状态保持
- Legacy Renderer / Plugin Renderer 双引擎切换
- 按文件类型懒加载 Preview Adapter
- 可配置大文件预览策略（`largeFilePolicy`），支持 warning / confirm / block 三档阈值自定义、`onError` 错误上报与自定义降级 UI
- HTML 支持安全预览、源码查看和需确认的完整预览模式
- GitHub Actions CI 自动验证
- GitHub Pages 自动部署

## 支持文件类型

| 类型 | 扩展名 | Plugin Renderer | 说明 |
|---|---|---|---|
| PDF | .pdf | ✅ | PDF.js 浏览器端渲染 |
| Code | .js/.ts/.tsx/.py/.go 等 | ✅ | Shiki 高亮 |
| JSON | .json | ✅ | 复用 Source Code Plugin |
| Text | .txt/.log/.env | ✅ | 纯文本预览 |
| Markdown | .md/.mdx | ✅ | GFM 渲染 |
| CSV | .csv | ✅ | 表格预览 |
| HTML | .html/.htm | ✅ | 安全预览 + 完整预览确认 + 源码 |
| SVG | .svg | ✅ | 预览 + 源码 |
| Image | .png/.jpg/.webp/.gif 等 | ✅ | 浏览器原生预览 |
| Audio | .mp3/.wav/.ogg 等 | ✅ | 浏览器原生播放器 |
| Video | .mp4/.webm/.mov 等 | ✅ | 浏览器原生播放器 |
| ZIP | .zip | ✅ | 压缩包预览 |
| EPUB | .epub | ✅ | EPUB 预览 |
| RTF | .rtf | ✅ | rtf.js 富文本渲染，复杂内容自动降级为文本预览 |
| DOCX | .docx | ✅ | 现代 Word 格式 |
| PPTX | .pptx | ✅ | 现代 PowerPoint 格式 |
| XLSX | .xlsx | ✅ | 现代 Excel 格式 |
| DOC | .doc | ⚠️ | 旧版 Word 二进制格式，降级支持 |
| PPT | .ppt | ❌ | 建议转为 .pptx |
| XLS | .xls | ❌ | 建议转为 .xlsx |

## 在其他项目中安装使用

基础安装：

```bash
pnpm add @lamberl-lee/file-preview
```

也可以使用 npm / yarn：

```bash
npm install @lamberl-lee/file-preview
yarn add @lamberl-lee/file-preview
```

如果国内镜像还没有同步最新版本，可临时指定官方 npm registry：

```bash
pnpm add @lamberl-lee/file-preview --registry https://registry.npmjs.org
```

`react` 和 `react-dom` 是 peer dependencies，业务项目需要已经安装 React 18.2+ 或 React 19。

### 最小接入：基础格式预览

根入口默认只包含轻量格式：Markdown、代码、HTML、JSON、CSV、SVG、纯文本、图片、音频、视频。适合先快速接入：

```tsx
import {
  PluginPreviewRenderer,
  detectFileType,
  type FileInfo,
} from "@lamberl-lee/file-preview";
import "@lamberl-lee/file-preview/styles/index.css";

function FilePreview({ file }: { file: File }) {
  const info: FileInfo = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    fileType: detectFileType(file.name, file.type),
    source: { kind: "file", file },
  };

  return <PluginPreviewRenderer file={info} />;
}
```

### 启用 PDF / Office / ZIP / EPUB 等重格式

重格式依赖体积较大，库不会默认打进根入口。业务项目按需安装对应 peer dependency，然后使用 `/full` registry：

```bash
pnpm add @lamberl-lee/file-preview pdfjs-dist docx-preview exceljs @aiden0z/pptx-renderer rtf.js jszip
```

```tsx
import {
  PluginPreviewRenderer,
  detectFileType,
  setAssetBasePath,
  type FileInfo,
} from "@lamberl-lee/file-preview";
import { createFullPreviewRegistry } from "@lamberl-lee/file-preview/full";
import "@lamberl-lee/file-preview/styles/index.css";

setAssetBasePath("");

const registry = createFullPreviewRegistry();

function FilePreview({ file }: { file: File }) {
  const info: FileInfo = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    fileType: detectFileType(file.name, file.type),
    source: { kind: "file", file },
  };

  return <PluginPreviewRenderer file={info} registry={registry} />;
}
```

只需要部分重格式时，也可以只安装并导入对应插件，例如 `@lamberl-lee/file-preview/plugins/pdf`、`@lamberl-lee/file-preview/plugins/pptx`。

### 静态资源配置

PDF.js worker 和 RTF.js bundles 需要放到业务项目的静态目录。可在业务项目 `package.json` 中加 postinstall：

```jsonc
{
  "scripts": {
    "postinstall": "node node_modules/@lamberl-lee/file-preview/scripts/copy-pdf-worker.mjs && node node_modules/@lamberl-lee/file-preview/scripts/copy-rtfjs-bundles.mjs"
  }
}
```

默认复制到：

- `public/vendor/pdfjs/pdf.worker.min.mjs`
- `public/vendor/rtfjs/{WMFJS,EMFJS,RTFJS}.bundle.min.js`

如果项目部署在子路径或 CDN 前缀下，启动时调用 `setAssetBasePath("/your-base-path")`。

### 远程文件接入

如果后端只给一个 URL，且需要前端下载后识别：

```tsx
import { processRemoteUrl } from "@lamberl-lee/file-preview";

const info = await processRemoteUrl("https://example.com/report.pdf");
```

如果后端文件列表已经返回 `name` 和 `size`，推荐用 `createRemoteFileInfo()`，这样大文件闸门可以在下载前生效：

```tsx
import { createRemoteFileInfo } from "@lamberl-lee/file-preview";

const info = createRemoteFileInfo({
  name: meta.name,
  size: meta.size,
  url: downloadUrl,
  id: `${meta.name}-${meta.last_modified}`,
});
```

更多细节见 [packages/file-preview/README.md](packages/file-preview/README.md)。

## 本地开发

```bash
pnpm install
pnpm run dev
```

访问：

```txt
http://localhost:3000
```

## 本地验证

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

或：

```bash
pnpm run check
```

## GitHub Pages 构建

```bash
pnpm --filter @lamberl-lee/playground run build:pages
```

## GitHub Actions

当前仓库包含以下工作流：

```txt
.github/workflows/ci.yml        # lint / test / build
.github/workflows/pages.yml     # lint / test / build:pages / deploy
```

CI 会自动执行 lint、test、build。Pages workflow 会自动构建并部署到 GitHub Pages。

## 当前限制

- 不承诺完整还原所有 Office 排版效果
- `.doc` 为旧版 Word 二进制格式，仅降级支持（文本提取）
- `.ppt` / `.xls` 暂不支持浏览器端预览
- PPTX 中的 EMF / WMF 图片无法被浏览器原生显示
- 大文件在浏览器端解析时可能卡顿，受浏览器性能限制
- 远程 URL 预览依赖目标服务器 CORS 配置，若目标服务器未允许浏览器跨域访问，则无法直接预览
- 所有预览均在浏览器端执行，最终效果受浏览器能力影响

## 大文件预览策略

`PluginPreviewRenderer` 默认启用大文件保护：20 MB 提示、50 MB 需用户确认、100 MB 拦截预览（仅提供下载）。可通过 `largeFilePolicy` prop 自定义：

```tsx
import { PluginPreviewRenderer, validatePreviewSizePolicy } from "@lamberl-lee/file-preview";

// 1. 自定义阈值（warning / confirm 可选，置 null 禁用某档）
<PluginPreviewRenderer
  file={file}
  registry={registry}
  largeFilePolicy={{
    warningBytes: 20 * 1024 * 1024,
    confirmBytes: 35 * 1024 * 1024,
    maxBytes: 50 * 1024 * 1024,
  }}
  onError={(error) => {
    if (error.code === "FILE_TOO_LARGE") {
      // 上报到监控系统：error.details.actualBytes / maxBytes / fileType
    }
  }}
  renderLargeFileFallback={({ file, maxBytes, download }) => (
    <div>
      {file.name} 超出 {maxBytes} 限制
      <button onClick={() => download().catch(console.error)}>下载</button>
    </div>
  )}
/>

// 2. 关闭限制（仅适用于已在外层做过大小控制的场景）
<PluginPreviewRenderer file={file} largeFilePolicy="off" />

// 3. 使用默认策略（20 / 50 / 100 MB）
<PluginPreviewRenderer file={file} largeFilePolicy="default" />
```

`largeFilePolicy` 是三段式分级闸门，按文件大小从宽松到严格依次触发：

| 字段 | 触发条件 | 行为 | 是否阻塞预览 |
|------|---------|------|--------------|
| `warningBytes` | `file.size >= warningBytes` | 预览上方显示非阻塞提示条（"大文件：X MB，预览可能较慢"），预览正常渲染 | 否 |
| `confirmBytes` | `file.size >= confirmBytes` | 弹出确认对话框，用户必须点击"继续预览"才会加载插件；未确认前不渲染 | 是（可绕过） |
| `maxBytes` | `file.size > maxBytes` | 完全阻止预览，仅显示下载按钮，并触发 `onError({ code: "FILE_TOO_LARGE" })` | 是（不可绕过） |

**约束**：三者必须满足 `warningBytes < confirmBytes < maxBytes`（严格小于），否则 `validatePreviewSizePolicy` 抛 `TypeError`。任一字段可设为 `null` 禁用对应档位，例如 `{ maxBytes: 50MB, warningBytes: null }` 只启用 confirm + block 两档。

**接收用户输入的 maxBytes 时**，应先 try/catch `validatePreviewSizePolicy` 校验，非法值回退到 `"default"`：

```tsx
const policy = useMemo(() => {
  const maxBytes = userMB * 1024 * 1024;
  try {
    validatePreviewSizePolicy({ maxBytes });
    return { maxBytes };
  } catch {
    return "default";
  }
}, [userMB]);
```

完整示例参考 [apps/playground/src/app/large-file-policy-demo.tsx](apps/playground/src/app/large-file-policy-demo.tsx)。

### 远程文件：用后端 metadata 提前判断闸门

如果后端文件列表已经返回 `name` + `size`（无需下载即可拿到大小），应使用 `createRemoteFileInfo()` 直接拼装 `FileInfo`，让闸门在**零网络请求**时即生效：

```tsx
import {
  PluginPreviewRenderer,
  createRemoteFileInfo,
} from "@lamberl-lee/file-preview";

interface BackendFileMeta {
  name: string;
  size: number;
  last_modified: number;
}

function FilePreview({ meta, downloadUrl }: {
  meta: BackendFileMeta;
  downloadUrl: string;
}) {
  const file = useMemo(
    () =>
      createRemoteFileInfo({
        name: meta.name,
        size: meta.size,           // ← 闸门立即基于此值判断
        url: downloadUrl,
        id: `${meta.name}-${meta.last_modified}`,
        // mimeType 可选；不传时 detectFileType 退化到只看扩展名
      }),
    [meta, downloadUrl],
  );

  return (
    <PluginPreviewRenderer
      file={file}
      registry={registry}
      largeFilePolicy={{
        warningBytes: 2 * 1024 * 1024,
        confirmBytes: 3 * 1024 * 1024,
        maxBytes: 5 * 1024 * 1024,
      }}
    />
  );
}
```

`createRemoteFileInfo()` 与 `processRemoteUrl()` 的关键差异：

| 能力 | `processRemoteUrl()` | `createRemoteFileInfo()` |
|------|----------------------|--------------------------|
| 大小判断时机 | 下载完后 | **metadata 到达即判断** ✅ |
| 是否发请求 | 立即 fetch 整个 body | 不发请求，plugin 渲染时才懒加载 |
| MIME 嗅探 | magic bytes + 扩展名 + Content-Type | 仅扩展名（或调用方传入的 `mimeType`） |
| 100 MB 硬上限 | 有（`DEFAULT_REMOTE_MAX_BYTES`） | 无，由 `largeFilePolicy.maxBytes` 替代 |
| 下载进度 | 有 `onProgress` | 无 |
| 错误归一化 | `RemoteUrlError` 带错误码 | 走 `readSourceAsArrayBuffer`，普通 `Error` |

> 适用场景：后端文件列表/网盘 API 已返回 `size` 字段、且你能从其他途径拿到下载 URL。否则继续用 `processRemoteUrl()`。

## HTML 预览安全模式

HTML 默认使用安全预览：iframe sandbox 不放开脚本、表单和弹窗，适合预览来源未知的 HTML 文件。

如果需要体验页面动效、脚本交互等完整效果，可以在业务侧接入 `onHtmlTrustedPreviewRequest`，先弹出确认提示，再调用 `request.confirm()` 开启完整预览：

```tsx
<PluginPreviewRenderer
  file={file}
  registry={registry}
  onHtmlTrustedPreviewRequest={(request) => {
    openConfirmDialog({
      fileName: request.fileName,
      onConfirm: request.confirm,
      onCancel: request.cancel,
    });
  }}
/>
```

完整预览会放开 HTML 内脚本执行，仅建议在信任文件来源时使用。公开 Demo 已内置确认弹窗作为参考。

## 文档

- 用户版支持矩阵：[docs/user-facing-preview-support.md](docs/user-facing-preview-support.md)
- Plugin 开发指南：[docs/plugin-development-guide.md](docs/plugin-development-guide.md)
- Plugin Renderer 验证矩阵：[docs/preview-plugin-validation-matrix.md](docs/preview-plugin-validation-matrix.md)
- GitHub Pages 发布检查清单：[docs/github-pages-release-checklist.md](docs/github-pages-release-checklist.md)

## Roadmap

下一阶段建议：

```txt
Stage 18：预览性能与大文件处理优化
```

候选方向（✅ 表示已落地）：

- ✅ 大文件预览策略可配置化（`largeFilePolicy`，含 warning / confirm / block 三档）
- ✅ 统一错误边界（`onError` + `PreviewError`，覆盖 `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `RENDER_FAILED` 等 code）
- 大文件读取进度提示
- PDF / Office 渲染取消机制
- Plugin 加载失败 fallback
- Worker 化部分解析任务
