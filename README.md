# FileVista

FileVista 是一个纯浏览器端文件预览工具集，基于 Next.js、React、TypeScript 和插件化 Preview Renderer 构建。支持 20+ 文件格式（PDF、Markdown、JSON、代码、DOCX、PPTX、XLSX、EPUB、图片、视频、音频等），支持本地 File/Blob/ArrayBuffer 和远程 URL。所有处理均在浏览器内完成，文件不会上传服务器。

在线 Demo：

https://coderlambert.github.io/filevista/

## Features

- 纯浏览器端文件预览，文件不上传服务器
- 支持本地 File / Blob / ArrayBuffer / 远程 URL
- 拖拽上传、多文件切换、TabCache 状态保持
- Legacy Renderer / Plugin Renderer 双引擎切换
- 按文件类型懒加载 Preview Adapter
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
| RTF | .rtf | ✅ | 文本提取预览 |
| DOCX | .docx | ✅ | 现代 Word 格式 |
| PPTX | .pptx | ✅ | 现代 PowerPoint 格式 |
| XLSX | .xlsx | ✅ | 现代 Excel 格式 |
| DOC | .doc | ⚠️ | 旧版 Word 二进制格式，降级支持 |
| PPT | .ppt | ❌ | 建议转为 .pptx |
| XLS | .xls | ❌ | 建议转为 .xlsx |

## 本地开发

```bash
bun install
bun run dev
```

访问：

```txt
http://localhost:3000
```

## 本地验证

```bash
bun run lint
bun run test:run
bun run build
```

或：

```bash
bun run check
```

## GitHub Pages 构建

```bash
bun run build:pages
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
- 所有预览均在浏览器端执行，最终效果受浏览器能力影响

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

候选方向：

- 大文件读取进度提示
- PDF / Office 渲染取消机制
- Plugin 加载失败 fallback
- Worker 化部分解析任务
- 统一错误边界
