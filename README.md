# FileVista

FileVista 是一个纯浏览器端文件预览工具集，基于 Next.js、React、TypeScript 和插件化 Preview Renderer 构建。支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等），预览内核支持 File / Blob / ArrayBuffer / URL 等数据源，当前公开 Demo 支持本地文件上传和可跨域访问的远程 URL 预览。所有处理均在浏览器内完成，文件不会上传服务器。

在线 Demo：

https://coderlambert.github.io/filevista/

## Features

- 支持本地文件上传，也支持可跨域访问的远程 URL 预览
- 预览内核支持 File / Blob / ArrayBuffer / URL 等数据源
- 拖拽上传、多文件切换、TabCache 状态保持
- Legacy Renderer / Plugin Renderer 双引擎切换
- 按文件类型懒加载 Preview Adapter
- 可配置大文件预览策略（`largeFilePolicy`），支持 warning / confirm / block 三档阈值自定义、`onError` 错误上报与自定义降级 UI
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
| HTML | .html/.htm | ✅ | 安全预览 + 源码 |
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
