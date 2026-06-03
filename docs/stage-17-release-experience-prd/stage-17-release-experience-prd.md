# FileVista Stage 17：发布态体验与文档完善规划

## 1. 阶段背景

FileVista 已经完成以下阶段：

```txt
Stage 14：Plugin Renderer 收口治理
Stage 15：Vitest 测试 + 组件交互测试 + 大文件体验兜底
Stage 16：CI 自动验证 + GitHub Pages 自动部署
```

当前项目已经具备：

```txt
1. Plugin Renderer 支持主流文件类型
2. 支持状态矩阵已经显式化
3. Vitest 已覆盖 registry、support-status、UnsupportedPluginPreview、LargeFileHint
4. GitHub Actions 已自动执行 lint / test / build
5. GitHub Pages 已自动部署
```

Stage 17 的目标不是继续扩展预览能力，而是把项目从“开发可用”推进到“发布态可展示、可验证、可维护”。

---

## 2. 阶段目标

Stage 17 聚焦发布态体验与文档完善。

核心目标：

```txt
1. README 增加在线 Demo 地址和项目当前能力说明
2. 首页增加发布态标识，让用户知道这是纯浏览器端文件预览工具
3. 增加用户友好的支持类型矩阵
4. 增加开发者友好的新增文件类型流程
5. 增加 GitHub Pages 部署验证清单
6. 明确当前不支持/降级支持的边界
7. 保持核心 Plugin Renderer 架构不变
```

本阶段完成后，FileVista 应该可以作为一个公开项目展示，并支持后续持续迭代。

---

## 3. 本阶段边界

### 3.1 本阶段要做

```txt
更新 README
新增发布态文档
新增用户版支持矩阵
新增开发者扩展指南
新增 GitHub Pages 验证清单
首页增加 Demo / GitHub / CI 状态入口
检查 Pages 下主要 Demo 文件能否正常加载
```

### 3.2 本阶段不做

```txt
不继续新增文件类型
不重构 Plugin Registry
不重构 Preview 组件内部解析逻辑
不引入新的大型依赖
不处理 TypeScript 历史类型债
不接入后端服务
不改动 CI 主流程
不改动 GitHub Pages 部署架构
```

---

## 4. 建议改动文件

### 4.1 新增文件

```txt
docs/stage-17-release-experience-prd.md
docs/user-facing-preview-support.md
docs/plugin-development-guide.md
docs/github-pages-release-checklist.md
```

### 4.2 修改文件

```txt
README.md
src/app/page.tsx
docs/preview-plugin-validation-matrix.md
```

### 4.3 可选修改文件

```txt
package.json
```

如果需要在 README 或页面中展示版本，可以考虑从 `package.json` 读取或手动维护版本号。

---

## 5. 任务拆分

## 5.1 任务 17.1：更新 README

### 目标

README 需要从“开发说明”升级为“项目主页说明”。

应该包含：

```txt
1. 项目简介
2. 在线 Demo 地址
3. 核心特性
4. 支持文件类型
5. 本地开发
6. 测试命令
7. CI / Pages 部署说明
8. 当前限制
9. 后续路线
```

### 建议 README 结构

````md
# FileVista

FileVista is a pure browser-side file preview playground built with Next.js, React, Tailwind CSS and a plugin-based preview renderer.

在线预览：

https://coderlambert.github.io/filevista/

## Features

- Pure browser-side file preview
- Plugin-based renderer architecture
- Legacy Renderer / Plugin Renderer switch
- PDF / Office / Markdown / Code / JSON / CSV / Image / Audio / Video support
- GitHub Pages deployment
- Vitest coverage for renderer registry and preview fallback behavior

## Supported File Types

| Type | Extensions | Plugin Renderer | Notes |
|---|---|---|---|
| PDF | .pdf | ✅ | Browser-side PDF.js rendering |
| Code | .js/.ts/.tsx/.py/.go etc. | ✅ | Shiki highlighting |
| JSON | .json | ✅ | Reuses source-code plugin |
| Text | .txt/.log/.env | ✅ | Plain text preview |
| Image | .png/.jpg/.webp/.gif | ✅ | Browser object URL |
| Audio | .mp3/.wav/.ogg | ✅ | Native audio player |
| Video | .mp4/.webm/.mov | ✅ | Native video player |
| SVG | .svg | ✅ | Preview + source |
| CSV | .csv | ✅ | Table preview |
| Markdown | .md/.mdx | ✅ | GFM rendering |
| HTML | .html/.htm | ✅ | Safe preview + source |
| RTF | .rtf | ✅ | Text extraction preview |
| ZIP | .zip | ✅ | Archive preview |
| EPUB | .epub | ✅ | EPUB preview |
| DOCX | .docx | ✅ | Modern Word format |
| PPTX | .pptx | ✅ | Modern PowerPoint format |
| XLSX | .xlsx | ✅ | Modern Excel format |
| DOC | .doc | ⚠️ | Legacy binary Word, download fallback |
| PPT | .ppt | ❌ | Convert to .pptx |
| XLS | .xls | ❌ | Convert to .xlsx |

## Development

```bash
bun install
bun run dev
````

## Quality Checks

```bash
bun run lint
bun run test:run
bun run build
```

Or run:

```bash
bun run check
```

## GitHub Pages Build

```bash
bun run build:pages
```

## Deployment

GitHub Actions automatically runs:

```txt
lint
test
build
pages deploy
```

GitHub Pages URL:

```txt
https://coderlambert.github.io/filevista/
```

## Current Limitations

* Legacy Office binary formats are not fully previewed
* Very large files may cause browser-side parsing delay
* All previews run in the browser, so behavior depends on browser capabilities

````

---

## 5.2 任务 17.2：首页增加发布态入口

### 目标

首页需要让用户快速知道：

```txt
这是 FileVista
这是纯浏览器端预览工具
可以查看 Demo
可以查看 GitHub
可以看到当前支持哪些类型
````

### 建议改动点

修改：

```txt
src/app/page.tsx
```

在 Header 右侧增加链接按钮：

```txt
GitHub
Docs
Live Demo
```

如果当前就是 GitHub Pages 环境，可以只展示：

```txt
GitHub
Support Matrix
```

### 示例 UI 文案

```txt
Pure browser-side file preview
No upload. No server processing.
```

中文可以写：

```txt
纯浏览器端文件预览，文件不会上传到服务器
```

### 建议不要做

```txt
不要引入复杂导航
不要引入路由文档页
不要做完整官网
```

本阶段只做发布态最小增强。

---

## 5.3 任务 17.3：新增用户版支持矩阵

新增文件：

```txt
docs/user-facing-preview-support.md
```

### 目标

当前 `preview-plugin-validation-matrix.md` 偏工程验证，不适合普通用户阅读。

新增用户版文档，重点回答：

```txt
哪些文件可以预览？
哪些文件不支持？
旧版 Office 为什么不支持？
大文件为什么会卡？
```

### 建议内容

```md
# FileVista Preview Support

## Fully Supported

| Category | Extensions | Notes |
|---|---|---|
| PDF | .pdf | PDF.js browser rendering |
| Code | .js/.ts/.tsx/.py/.go etc. | Syntax highlighting |
| Text | .txt/.log/.env | Plain text |
| Markdown | .md/.mdx | GFM rendering |
| JSON | .json | Formatted source preview |
| CSV | .csv | Table preview |
| Image | .png/.jpg/.webp/.gif/.svg | Browser preview |
| Audio | .mp3/.wav/.ogg | Native player |
| Video | .mp4/.webm/.mov | Native player |
| Office | .docx/.pptx/.xlsx | Modern Office formats |
| Archive | .zip | Archive preview |
| EPUB | .epub | EPUB preview |
| RTF | .rtf | Text extraction preview |

## Limited / Unsupported

| Type | Status | Reason |
|---|---|---|
| .doc | Limited | Legacy binary Word format |
| .ppt | Unsupported | Legacy binary PowerPoint format |
| .xls | Unsupported | Legacy binary Excel format |
| unknown | Unsupported | Unknown file type |

## Large Files

For large PDF / DOCX / PPTX / XLSX / ZIP / EPUB files, FileVista may show a warning.

This does not block preview. It only means browser-side parsing may take longer.
```

---

## 5.4 任务 17.4：新增 Plugin 开发指南

新增文件：

```txt
docs/plugin-development-guide.md
```

### 目标

后续新增文件类型时，不再靠记忆，而是按固定流程做。

### 建议内容

````md
# FileVista Plugin Development Guide

## 1. Add FileType

Update:

```txt
src/components/file-preview/utils.ts
````

Add the new type to:

```ts
ALL_FILE_TYPES
```

## 2. Update detectFileType

Add extension / MIME detection logic in:

```txt
detectFileType()
```

## 3. Create Plugin

Create:

```txt
src/components/file-preview/plugins/<type>-plugin.ts
```

Example:

```ts
import type { PreviewPlugin } from "../core/plugin";

export const examplePlugin: PreviewPlugin = {
  id: "builtin.example",
  name: "Example Preview",
  priority: 100,
  match: (file) => file.fileType === "example",
  load: () => import("../preview-adapters/ExamplePreviewAdapter"),
};
```

## 4. Create Adapter

Create:

```txt
src/components/file-preview/preview-adapters/ExamplePreviewAdapter.tsx
```

Adapter rules:

```txt
1. Validate required input
2. Bridge FileInfo to existing Preview component
3. Return UnsupportedPluginPreview when input is missing
4. Do not parse heavy content inside adapter
```

## 5. Register Plugin

Update:

```txt
src/components/file-preview/plugins/builtin-plugins.ts
```

Add the plugin to:

```ts
builtinPreviewPlugins
```

## 6. Update Support Matrix

Update:

```txt
src/components/file-preview/support-status.ts
```

Add metadata:

```ts
example: {
  fileType: "example",
  status: "plugin-supported",
  legacyRenderer: "unsupported",
  pluginRenderer: "supported",
  pluginId: "builtin.example",
}
```

## 7. Update Tests

Run:

```bash
bun run test:run
```

If registry test fails, check:

```txt
plugin id
plugin match
builtin registration
support-status pluginId
```

## 8. Update Docs

Update:

```txt
docs/preview-plugin-validation-matrix.md
docs/user-facing-preview-support.md
README.md
```

## 9. Final Check

```bash
bun run check
bun run build:pages
```

````

---

## 5.5 任务 17.5：新增 GitHub Pages 发布验证清单

新增文件：

```txt
docs/github-pages-release-checklist.md
````

### 目标

每次 GitHub Pages 发布后，有一个可执行检查清单。

### 建议内容

````md
# GitHub Pages Release Checklist

## 1. Deployment

Check GitHub Actions:

```txt
Actions → Deploy GitHub Pages
````

Expected:

```txt
build ✅
deploy ✅
```

## 2. Visit Site

Open:

```txt
https://coderlambert.github.io/filevista/
```

Expected:

```txt
Page loads without blank screen
No obvious console errors
Static assets load correctly
```

## 3. Demo Files

Click:

```txt
Demo Files
```

Expected:

```txt
Text demos load
Binary demos load
DOCX demo previews
XLSX demo previews
EPUB demo previews
```

## 4. PDF Worker

Upload a PDF file.

Expected:

```txt
PDF renders successfully
No 404 for /filevista/vendor/pdfjs/pdf.worker.min.mjs
```

## 5. Plugin Renderer

Switch to Plugin Renderer.

Expected examples:

```txt
PDF → builtin.pdf
JSON → builtin.source-code
DOCX → builtin.docx
PPTX → builtin.pptx
XLSX → builtin.xlsx
```

## 6. Unsupported Types

Upload or test unsupported types:

```txt
.doc
.ppt
.xls
unknown
```

Expected:

```txt
.doc → legacy Word warning + download
.ppt → unsupported warning
.xls → unsupported warning
unknown → Preview Not Available
```

## 7. Large File Hint

Upload a large file:

```txt
>= 20MB PDF / DOCX / PPTX / XLSX / ZIP / EPUB
```

Expected:

```txt
Large file warning appears above preview area
```

## 8. Browser Console

Open DevTools:

```txt
Console
Network
```

Expected:

```txt
No critical runtime errors
No unexpected 404 under /filevista
```

````

---

## 5.6 任务 17.6：更新验证矩阵文档

修改：

```txt
docs/preview-plugin-validation-matrix.md
````

追加一节：

````md
## 12. Stage 17 发布态体验检查

Stage 17 增加发布态文档和 GitHub Pages 验证清单。

新增文档：

```txt
docs/user-facing-preview-support.md
docs/plugin-development-guide.md
docs/github-pages-release-checklist.md
docs/stage-17-release-experience-prd.md
````

发布后需要检查：

```txt
1. README 在线 Demo 地址正确
2. GitHub Pages 可以正常访问
3. Demo Files 可以正常加载
4. PDF worker 没有 404
5. Plugin Renderer debug bar 在生产环境不显示
6. 用户版支持矩阵与 support-status.ts 保持一致
```

````

---

## 6. 推荐实施顺序

### Step 1：新增文档

```bash
touch docs/stage-17-release-experience-prd.md
touch docs/user-facing-preview-support.md
touch docs/plugin-development-guide.md
touch docs/github-pages-release-checklist.md
````

### Step 2：更新 README

重点加入：

```txt
在线 Demo 地址
支持文件类型
本地开发
测试命令
CI / Pages 部署说明
当前限制
```

### Step 3：轻量更新首页

修改：

```txt
src/app/page.tsx
```

只加发布态入口，不改核心上传/预览逻辑。

### Step 4：同步 validation matrix

修改：

```txt
docs/preview-plugin-validation-matrix.md
```

追加 Stage 17 说明。

### Step 5：验证

执行：

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

### Step 6：提交

```bash
git add README.md
git add src/app/page.tsx
git add docs/stage-17-release-experience-prd.md
git add docs/user-facing-preview-support.md
git add docs/plugin-development-guide.md
git add docs/github-pages-release-checklist.md
git add docs/preview-plugin-validation-matrix.md

git commit -m "docs: polish release experience and plugin documentation"
git push
```

---

## 7. 验收标准

Stage 17 完成后，需要满足：

```txt
1. README 能清楚说明 FileVista 是什么
2. README 包含 GitHub Pages 在线 Demo 地址
3. README 包含本地开发、测试、构建、Pages 构建命令
4. 用户版支持矩阵已建立
5. Plugin 开发指南已建立
6. GitHub Pages 发布验证清单已建立
7. 首页有基础发布态入口
8. GitHub Pages 上 Demo Files 可正常加载
9. GitHub Pages 上 PDF worker 不出现 404
10. CI 和 Pages workflow 仍然全部通过
```

---

## 8. 风险与注意点

### 8.1 README 不要过度承诺

不要写：

```txt
支持所有 Office 文件
支持所有浏览器
支持任意大文件
完全还原所有文档格式
```

应该写：

```txt
支持主流现代格式
旧版 Office 二进制格式有限支持或不支持
大文件可能有浏览器端性能限制
```

### 8.2 用户文档和工程矩阵要同步

如果修改了：

```txt
support-status.ts
```

需要同步：

```txt
README.md
docs/user-facing-preview-support.md
docs/preview-plugin-validation-matrix.md
```

### 8.3 Pages 下不要写死根路径

避免：

```ts
fetch("/demo/xxx")
"/vendor/pdfjs/xxx"
```

应该使用：

```ts
process.env.NEXT_PUBLIC_BASE_PATH
```

---

## 9. 阶段完成后的项目状态

Stage 17 完成后，FileVista 将具备：

```txt
1. 可公开访问的在线 Demo
2. 自动化 CI 验证
3. 自动化 GitHub Pages 部署
4. 插件化文件预览架构
5. 明确的文件类型支持矩阵
6. 可执行的新增 Plugin 流程
7. 可执行的发布后验证清单
```

这时项目已经从“功能开发项目”进入“可展示、可维护、可持续迭代项目”状态。

---

## 10. 下一阶段建议

Stage 17 完成后，建议进入：

```txt
Stage 18：预览性能与大文件处理优化
```

候选方向：

```txt
1. 大文件读取进度提示
2. 二进制文件懒读取策略
3. PDF / Office 渲染取消机制完善
4. Worker 化部分重解析任务
5. 文件预览错误边界统一
6. Plugin 加载失败 fallback
```

Stage 18 开始才适合继续碰性能和复杂体验，不建议在 Stage 17 中提前展开。
