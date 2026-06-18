已整理成可直接放进项目的 Markdown 文档：
[下载 rtf-preview-rendering-plan.md](sandbox:/mnt/data/rtf-preview-rendering-plan.md)

我建议集成路径：

```bash
mkdir -p docs
cp rtf-preview-rendering-plan.md docs/rtf-preview-rendering-plan.md
```

你的 `filevista` README 当前已经明确项目是“纯浏览器端文件预览工具集”，支持插件化懒加载 Preview Adapter，并且 `.rtf` 当前状态是“文本提取预览”，所以这份文档定位为 **RTF 富文本渲染升级方案** 是合适的。([GitHub][1]) 你的现有 Plugin 开发指南也要求新增/同步 `FileType`、Plugin、Adapter、Support Matrix 和 Docs，这份文档已经按这个流程组织。([GitHub][2])

可以顺手把 README 的文档区加一行：

```md
- RTF 富文本渲染升级方案：docs/rtf-preview-rendering-plan.md
```

核心技术路线是：

```txt
rtf.js
  -> 渲染 RTF 为 HTML elements

DOMPurify
  -> 清洗 HTML，降低 XSS 风险

iframe sandbox srcDoc
  -> 隔离样式、脚本和主应用 DOM

fallback text extraction
  -> 复杂 / 损坏 / 超大 RTF 降级为纯文本预览
```

`rtf.js` 官方定位就是将 RTF 渲染为 HTML，并包含 WMF / EMF 图片渲染能力；DOMPurify 官方定位是清洗 HTML 并防止 XSS；`Blob.arrayBuffer()` 也适合当前 FileVista 的纯前端 File/Blob/ArrayBuffer 数据源处理链路。([GitHub][3])

下面是文档开头的可复制版本，完整版本见上面的文件：

# RTF 纯前端渲染升级方案

> 目标文件路径建议：`docs/rtf-preview-rendering-plan.md`
> 适用项目：FileVista
> 目标：将当前 `.rtf` 的“文本提取预览”升级为“HTML 富文本渲染 + 安全隔离 + 文本降级”的纯前端方案。

## 推荐结论

RTF 最佳纯前端方案建议采用：

```txt
主渲染库：rtf.js
安全清洗：dompurify
渲染隔离：iframe sandbox srcDoc
失败降级：保留现有文本提取能力
```

## 集成步骤

```bash
bun add rtf.js dompurify
```

建议新增或升级文件：

```txt
src/components/file-preview/plugins/rtf-plugin.ts
src/components/file-preview/preview-adapters/RtfPreviewAdapter.tsx
src/components/file-preview/previewers/rtf/RtfHtmlPreview.tsx
src/components/file-preview/previewers/rtf/extract-rtf-text.ts
src/components/file-preview/previewers/rtf/build-rtf-src-doc.ts
src/types/rtf-js.d.ts
```

README 支持矩阵建议从：

```txt
RTF .rtf ✅ 文本提取预览
```

更新为：

```txt
RTF .rtf ✅ 基础富文本渲染，复杂内容降级为文本预览
```

## 最终策略

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

我没有直接向 GitHub 远程仓库提交变更；当前可用的 GitHub 写入工具上下文返回了不匹配的仓库内容，我避免误写。你可以把下载的文档放到 `docs/rtf-preview-rendering-plan.md` 后提交：

```bash
git add docs/rtf-preview-rendering-plan.md README.md
git commit -m "docs: add rtf preview rendering plan"
git push
```

[1]: https://github.com/CoderLambert/filevista "GitHub - CoderLambert/filevista: FileVista - 纯浏览器端文件预览工具集，支持本地 File/Blob/ArrayBuffer 和远程 URL · GitHub"
[2]: https://raw.githubusercontent.com/CoderLambert/filevista/main/docs/plugin-development-guide.md "raw.githubusercontent.com"
[3]: https://github.com/tbluemel/rtf.js "GitHub - tbluemel/rtf.js: Render RTF documents in HTML. · GitHub"
