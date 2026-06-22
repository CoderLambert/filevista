# refactor(pptx): replace pptx-preview with @aiden0z/pptx-renderer

## 改动背景

旧版 PPTX 预览基于 `pptx-preview` 库，存在以下问题：

1. **iframe 隔离方案复杂**：需要将 pptx-preview 的 DOM 输出克隆到 iframe 中并注入 CSS 覆盖样式，维护成本高
2. **缩放和布局控制困难**：需要手动计算 scale、管理 MutationObserver 同步、处理 iframe 高度自适应
3. **功能有限**：不支持 SmartArt、图表、嵌入式字体等高级特性
4. **无懒加载**：所有幻灯片一次性渲染，大文件性能差

## 改动方案

### 架构变更

引入 `@aiden0z/pptx-renderer` 作为新的 PPTX 渲染引擎，采用三层架构：

```
PptxPreviewAdapter → PptxPreview → PptxEngine → @aiden0z/pptx-renderer
```

新增 `engines/pptx/pptx-renderer-engine.ts` 作为 FileVista 与第三方引擎之间的唯一边界层，负责：
- 将 `PreviewSource` 转换为 `ArrayBuffer`
- 动态导入引擎（避免 SSR 问题 + 按需加载）
- 配置 ZIP 安全限制、懒加载选项
- 返回统一的 `PptxViewerController` 接口

### 关键实现

1. **PptxViewerController 抽象**：封装引擎的 `slideCount`、`currentSlideIndex`、`zoomPercent`、`fitMode` 属性和 `goToSlide()`、`setZoom()`、`setFitMode()`、`destroy()` 方法

2. **PptxPreview 组件重写**：
   - 移除 iframe、MutationObserver、手动缩放逻辑
   - 直接使用 `openPptxViewer()` 挂载到 DOM 容器
   - 保留工具栏、键盘导航、全屏、模式切换等 UI 功能
   - 保留 PptxSummaryFallback 和 PptxSemanticFallback 错误回退

3. **引擎配置**：
   - `lazySlides: true` + `lazyMedia: true`：按需解析幻灯片和媒体
   - `zipLimits: RECOMMENDED_ZIP_LIMITS`：防止恶意文件 DoS
   - `listOptions: { windowed: true }`：大文件窗口化渲染
   - `pdfjs: false`：第一阶段关闭 EMF 内嵌 PDF fallback

4. **清理旧代码**：
   - 删除 `usePptxFitScale.ts`（引擎内部处理缩放）
   - 删除 `normalize-preview-model.ts`（旧库专用）
   - 删除相关测试文件
   - 简化 `constants.ts`（移除 PPTX_BASE_WIDTH/HEIGHT）
   - 简化 `types.ts`（移除 PptxFitMode、PptxFitState、PptxRenderHandle）
   - 更新 CSS（移除 iframe/stage/scale-layer 样式）

### 依赖变更

**packages/file-preview/package.json**：
- 移除 `pptx-preview` peerDependency 和 devDependency
- 新增 `@aiden0z/pptx-renderer` optional peerDependency 和 devDependency

**apps/playground/package.json**：
- 移除 `pptx-preview`
- 新增 `@aiden0z/pptx-renderer`

**Plugin 加载**：
- `pptx-plugin.ts` 的 `loadWithOptionalDep` 先检查 `@aiden0z/pptx-renderer` 是否可用

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/package.json` | 修改：替换依赖 |
| `apps/playground/package.json` | 修改：替换依赖 |
| `pnpm-lock.yaml` | 修改：锁文件更新 |
| `packages/file-preview/src/engines/pptx/pptx-renderer-engine.ts` | 新增：引擎适配层 |
| `packages/file-preview/src/PptxPreview.tsx` | 重写：使用新引擎 |
| `packages/file-preview/src/preview-adapters/PptxPreviewAdapter.tsx` | 微调：保持接口兼容 |
| `packages/file-preview/src/plugins/pptx-plugin.ts` | 修改：更新依赖检查 |
| `packages/file-preview/src/pptx/types.ts` | 简化：移除未使用类型 |
| `packages/file-preview/src/pptx/constants.ts` | 简化：移除未使用常量 |
| `packages/file-preview/src/styles/PptxPreview.css` | 重写：移除 iframe 样式 |
| `packages/file-preview/src/pptx/usePptxFitScale.ts` | 删除 |
| `packages/file-preview/src/pptx/normalize-preview-model.ts` | 删除 |
| `packages/file-preview/src/__tests__/normalize-preview-model.test.ts` | 删除 |

## 验证结果

- `pnpm run typecheck`：通过
- `pnpm run lint`：通过
- `pnpm run test`：115 tests passed
- `pnpm run build`（file-preview tsup）：通过，PptxPreview.js 12.18 KB（从 23.89 KB 减少）

## 后续工作

1. **EMF/PDF fallback**：稳定后启用 `pdfjs` 配置，传入 FileVista 的 PDF worker URL
2. **搜索功能**：利用引擎的 `searchText()` API 实现 PPTX 文本搜索
3. **缩略图**：利用 `renderThumbnailToContainer()` 实现网格模式缩略图
4. **性能优化**：根据实际文件测试调整 `listOptions` 参数
