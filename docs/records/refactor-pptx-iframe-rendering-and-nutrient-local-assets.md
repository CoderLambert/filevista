# refactor: PPTX iframe-based rendering and Nutrient local asset serving

## 改动背景

PPTX 预览存在两个问题：

1. **样式泄漏**：`pptx-preview` 库直接操作 `document` 创建 DOM 节点，其内联样式和全局 CSS 会污染宿主页面，导致滚动条、布局溢出等问题。之前的 `cleanupPptxPreviewDom()` 通过遍历所有元素强制设置 `overflow: hidden` 来修补，但效果不稳定且维护成本高。

2. **Nutrient Web SDK 依赖 CDN**：NutrientPptxPreviewAdapter 使用 `useCDN: true` 加载 SDK 资源，在离线环境或 GitHub Pages 部署（有 base path 前缀）时无法正常工作。

## 改动方案

### Commit 1: refactor(pptx): iframe-based rendering with visual redesign

**架构变更**：将渲染隔离到 iframe 中，彻底解决样式泄漏问题。

- **隐藏容器 + iframe 双容器架构**：`pptx-preview` 库在隐藏的 `div`（`position: fixed; clipPath: inset(100%)`）中渲染，通过 `MutationObserver` 监听 DOM 变化，将内容克隆到可见的 `<iframe>` 中
- **CSS 注入**：`buildIframeCss()` 生成作用域化的 CSS 覆盖 `pptx-preview` 的内联样式，包括：
  - 移除导航按钮（`button`, `[class*="pre-btn"]` 等）
  - 强制 slide wrapper 宽度 100%、overflow hidden
  - 内层 div 使用 `position: absolute` + JS 计算的 `scale()` 实现响应式缩放
- **MutationObserver 同步**：debounce 16ms（一帧），导航切换、异步图片加载等变化自动同步到 iframe
- **iframe 自动调高**：`useEffect` 每 200ms 检查 `doc.body.scrollHeight`，自动调整 iframe 高度
- **Grid 模式改进**：不传 `height` 给 `pptx-preview`，避免库在内部 wrapper 上设置 `overflow-y: auto`；scale layer 使用 `transform: none`，内容自然流式排列

**Fit-scale 改进**（`usePptxFitScale.ts`）：

- 改用 `useLayoutEffect` 替代 `useEffect`，消除首帧闪烁（之前初始 scale 基于 960px 默认宽度，导致 stage 比容器宽）
- 新增 `measureWrapPadding()` 读取 wrap 元素的实际 padding（桌面端 2rem = 64px），替代固定 32px 常量
- 新增 `maxScaleByWidth` 钳制：`displayScale = min(fitScale * userZoom, viewportWidth / baseWidth)`，防止缩放时 stage 宽度溢出

**视觉重设计**（`PptxPreview.css`）：

- 工具栏：glassmorphism 效果（`backdrop-filter: blur(8px)`）、半透明背景、暗色模式适配
- 按钮：统一 36px 尺寸、hover 上浮动画（`translateY(-1px)`）、active 模式按钮使用 primary 色填充
- 缩放组：独立边框容器、半透明背景、zoom label 可点击重置
- Stage：12px 圆角、多层阴影、hover 加深效果、暗色模式完整适配
- 背景：渐变背景（`linear-gradient(135deg, #f8fafc, #f1f5f9)`）
- 响应式：640px 以下工具栏紧凑布局

**Playground 修复**：

- `page.tsx`：主预览区域和空状态添加 `min-w-0`，防止 flex 子元素溢出

### Commit 2: feat(playground): serve Nutrient Web SDK assets locally

- `NutrientPptxPreviewAdapter.tsx`：将 `useCDN: true` 替换为 `baseUrl`，使用 `window.location.origin` + `NEXT_PUBLIC_BASE_PATH` 构建绝对 URL，支持 GitHub Pages 部署
- 新增 `copy-nutrient-assets.mjs`：从 `node_modules` 复制 Nutrient SDK 的 `nutrient-viewer.js`、`index.d.ts`、`nutrient-viewer-lib/` 到 `public/vendor/nutrient/`
- `package.json`：`copy:vendor-assets` 脚本追加 `node scripts/copy-nutrient-assets.mjs`
- `.gitattributes`：新增 `apps/playground/public/vendor/**` LFS 规则，跟踪 216MB 的 WASM、字体、数据文件

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/src/PptxPreview.tsx` | 重构：iframe 架构替代直接 DOM 操作 |
| `packages/file-preview/src/pptx/usePptxFitScale.ts` | 改进：useLayoutEffect、动态 padding、scale 钳制 |
| `packages/file-preview/src/styles/PptxPreview.css` | 重设计：glassmorphism、暗色模式、响应式 |
| `apps/playground/src/app/page.tsx` | 修复：min-w-0 防溢出 |
| `apps/playground/src/preview-adapters/NutrientPptxPreviewAdapter.tsx` | 改进：baseUrl 替代 useCDN |
| `apps/playground/package.json` | 新增：copy:vendor-assets 包含 Nutrient |
| `apps/playground/scripts/copy-nutrient-assets.mjs` | 新增：复制 Nutrient SDK 到 public |
| `apps/playground/public/vendor/nutrient/` | 新增：216MB vendor assets（LFS） |
| `.gitattributes` | 新增：vendor/** LFS 规则 |

## 验证结果

- `pnpm run typecheck`：通过
- `pnpm run lint`：通过
- `pnpm run build`（file-preview tsup）：通过，PptxPreview.js 23.89 KB
