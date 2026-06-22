# PPTX 模块与包发布边界 — 全面修复

## 背景

基于 19 项代码审查问题（6 P0 + 6 P1 + 7 P2）的系统性修复，涵盖：包入口拆分、PPTX 异步生命周期、错误接入顶层 API、Viewer/UI 状态一致性、Fallback 正确性、浏览器兼容性、i18n、'use client' 指令、性能限制，以及新增测试套件。

## 变更内容

### Stage 1 — 包入口拆分 (base/full/plugins/*)

**新增文件**：
- `src/plugins/base-plugins.ts` — `basePreviewPlugins`（不含 PDF/DOCX/PPTX/XLSX/RTF/ZIP/EPUB 等可选 peer dep 的插件）+ `createBasePreviewRegistry()`
- `src/entries/full.ts` — `@lamberl-lee/file-preview/full` 子入口，重导出 `createFullPreviewRegistry` 和所有重型插件
- `src/entries/plugins/*.ts` — 7 个子入口：`pptx`、`pdf`、`docx`、`xlsx`、`rtf`、`zip`、`epub`

**修改文件**：
- `package.json` — `exports` 新增 `./full`、`./plugins/pptx` 等子路径
- `src/PluginPreviewRenderer.tsx` — 默认 registry 从 `createBuiltinPreviewRegistry` 改为 `createBasePreviewRegistry`（breaking change）
- `src/index.ts` — 新增 `basePreviewPlugins`、`createBasePreviewRegistry` 导出；附注释说明根入口保持向后兼容
- `apps/playground/src/app/page.tsx` — 显式传入 `registry={createBuiltinPreviewRegistry()}` 保持全格式预览

### Stage 2 — PPTX 异步生命周期重构

- `engines/pptx/pptx-renderer-engine.ts`：
  - `OpenPptxViewerOptions.source` → `input: ArrayBuffer`，engine 不再负责读取 source
  - `new PptxViewer()` + `try/catch` 包装确保 `destroy()` 在 open 失败时被调用
  - 改用 `parseZipLazyMedia`（不加载媒体到内存）
  - 返回 `presentationRels`
- `PptxPreview.tsx`：
  - 主 effect 先 `readSourceAsArrayBuffer` 一次，buffer 在 viewer + fallback 间共享
  - 所有外部 callback 调用改用 `safelyInvoke` 包裹
  - mount effect cleanup 递增 `modeOperationRef.current`（取消旧操作）
  - 移除 `process.env.NODE_ENV` 裸引用，改用 `typeof process !== "undefined"` 守卫 + `useEffect`
  - `onError` 调用移到 fallback 完成之后（fallback 成功时不再调用）

### Stage 3 — 错误接入顶层 onError

- `core/plugin.ts` — 新增 `PreviewAdapterProps` 接口，含 `reportError?: (error: PreviewError) => void`；`PreviewPlugin.load()` 的组件类型改为 `ComponentType<PreviewAdapterProps>`
- `PluginPreviewRenderer.tsx` — 注入 `reportError={onError}` 到适配器组件
- `preview-adapters/PptxPreviewAdapter.tsx` — 接收 `reportError` 并转发为 `onError` 给 `PptxPreview`，用 `PreviewError` 包装

### Stage 4 — Viewer/UI 状态一致性

- 新增 `activeViewMode` 双态机制：`viewMode` 为消费者意图，`activeViewMode` 为 Viewer 实际生效态
- 模式切换失败时 `setViewMode(activeViewMode)` 回滚
- zoomOut/zoomIn/resetZoom 失败时回滚旧值
- `fullscreenTargetRef` 隔离多实例全屏状态

### Stage 5 — Fallback 正确性

- `engines/pptx/pptx-renderer-engine.ts` — `SafePptxArchive` 新增 `presentationRels`
- `pptx/order-slides.ts` — 新增 `orderSlidesByPresentation`，解析 `p:sldIdLst` + `presentation.xml.rels` 确定真实幻灯片顺序；失败时降级为文件名排序
- `PptxPreview.tsx` — fallback 中 `sortSlides` → `orderSlidesByPresentation`
- `styles/PptxSemanticFallback.css` — 删除固定 `aspect-ratio: 16 / 9`
- `PptxSemanticFallback.tsx` — canvas 的 inline style 中加 `aspectRatio: ${deck.width} / ${deck.height}`

### Stage 6 — 浏览器兼容 & i18n & 文档

- `core/abort-compat.ts` — 新增 `throwIfAbortedCompat`，替换 2 处原生 `signal?.throwIfAborted()`
- `base.css` — 新增 `--fv-*-rgb` 配套 token
- 全部 17 个 CSS 文件中 46 处 `color-mix` 加 `rgba()` fallback
- `core/i18n.ts` — 新增 5 个 PPTX fallback keys（`pptxFallbackTitle`、`pptxFallbackSemanticDesc`、`pptxFallbackSummaryDesc`、`pptxFallbackImages`、`pptxFallbackTextBlocks`），中英文均补齐
- `PptxSemanticFallback.tsx`、`PptxSummaryFallback.tsx` — 改用 i18n keys
- 42 个客户端组件/ hooks/adapters 文件添加 `"use client"` 指令
- `docs/supported-formats.md` — PPTX 引擎从 `pptx-preview` → `@aiden0z/pptx-renderer`，能力边界更新

### Stage 7 — Fallback 性能限制

- `pptx/constants.ts` — 新增 `PPTX_FALLBACK_LIMITS`（maxSlides: 200, maxXmlBytesPerSlide: 4 MiB, maxTotalXmlBytes: 32 MiB, maxTextItemsPerSlide: 1000, yieldEverySlides: 8）
- `read-pptx-insight.ts` — 应用 limits + 每 8 张 yield 主线程
- `read-pptx-semantic-deck.ts` — 应用 maxSlides + yield

### Stage 8 — 测试

- `__tests__/order-slides.test.ts` — 6 项单元测试（sldIdLst 顺序、缺失 sldIdLst 降级、空 rels 降级、缺失 slide 跳过、路径前缀标准化、rId 不匹配降级）
- `__tests__/PptxPreview.lifecycle.test.tsx` — 4 项目标测试（open 失败销毁、onReady 抛错不触发 fallback、renderList 失败回滚、fallback 完成后只调用一次 onError）

## Migration Guide

**从 0.3.x 升级到 0.4.x 的 Breaking Change**：

`<PluginPreviewRenderer file={...} />` 现在默认使用 `createBasePreviewRegistry()`（不含 PDF/DOCX/PPTX/XLSX/RTF/ZIP/EPUB 插件）。如果需要预览这些格式，必须显式传入 full registry：

```tsx
import {
  PluginPreviewRenderer,
  createBuiltinPreviewRegistry,
} from "@lamberl-lee/file-preview";

const registry = createBuiltinPreviewRegistry();

<PluginPreviewRenderer file={file} registry={registry} />
```

或者使用子入口：

```ts
import { pptxPlugin } from "@lamberl-lee/file-preview/plugins/pptx";
```

## 验证

- `pnpm typecheck` — 通过
- `pnpm test` — 125 tests passed (10 existing + 8 new = 18 test files)
- `pnpm build` — 构建成功，子入口正确生成