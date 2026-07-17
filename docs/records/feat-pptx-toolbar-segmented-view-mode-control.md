# feat: PPTX 工具栏重新设计为分段式视图切换控件

## 改动背景

PPTX 预览组件的工具栏存在以下体验问题：

1. **视图切换不够直观**：原工具栏右侧仅有图标按钮（`MonitorIcon` + `Grid3X3Icon`）切换 "幻灯片视图" / "缩略图视图"，新用户难以一眼识别两种模式的语义差异，需要 hover 才能看到 title 提示。
2. **布局信息密度失衡**：分页导航控件只在幻灯片视图下显示，但仍占据工具栏右侧位置，导致 grid 模式下右侧出现空白。
3. **响应式能力薄弱**：原样式仅有 `max-width: 640px` 一档断点，没有针对中等宽度屏幕的紧凑布局策略；图标按钮宽度固定 32/36px，与新的设计语言（参考 `fv-html__fit-btn`、`fv-html__source-group`）不一致。
4. **可访问性不足**：视图切换按钮缺少 `aria-pressed` 状态标记，仅靠 `className` 表达 active 状态，屏幕阅读器无法正确识别。
5. **测试脆弱**：生命周期测试通过本地化 title 字符串（`"缩略图视图"`）查找 grid 切换按钮，一旦 i18n 文案修改即会失效。

## 改动方案

### 1. 工具栏三段式布局重构 (`PptxPreview.tsx`)

将原"左侧页码 + 右侧全部控件"的布局改为 **左 / 中 / 右** 三段：

- **左侧**：页码计数器 + 上一页/下一页导航按钮。导航按钮在 grid 视图下通过 `fv-pptx__nav--hidden`（`visibility: hidden + pointer-events: none`）保留布局空间但隐藏交互，避免工具栏宽度抖动。
- **中间**（新增 `fv-pptx__toolbar-center`，`flex: 1 1 auto`）：分段式视图切换控件 `fv-pptx__mode-switch`，包含两个并排按钮 `fv-pptx__mode-item`，每个按钮显示图标 + 全称标签 + 短标签。
- **右侧**：缩放控件组 + 全屏按钮，保持原功能。

### 2. 分段式视图切换控件

每个 `fv-pptx__mode-item` 按钮：

- 同时渲染 `<span class="fv-pptx__mode-item-label">`（全称）和 `<span class="fv-pptx__mode-item-label-short">`（短标签），由 CSS 媒体查询控制显隐。
- 添加 `data-active` 和 `aria-pressed` 属性，同时表达 active 状态，便于 CSS 选择器和屏幕阅读器识别。
- `title` 属性扩展为两行：`${label}\n${hint}`，鼠标 hover 时显示模式说明。

### 3. 图标替换 (`icons.tsx`)

- 移除 `Grid3X3Icon` 的使用，新增 `LayoutGridIcon`（4 个圆角方块组成的网格图标），语义上更贴近"缩略图总览"。
- `MonitorIcon` 保留用于"单页预览"按钮。

### 4. i18n 文案扩展与重命名 (`core/i18n.ts`)

新增 `LocaleMessages` 字段：

| 字段 | zhCN | enUS |
|------|------|------|
| `previewMode` | 预览方式 | Preview mode |
| `slideViewShort` | 单页 | Single |
| `gridViewShort` | 总览 | All |
| `slideViewHint` | 逐页查看 PPT，支持翻页和缩放 | View slides one at a time with zoom and navigation |
| `gridViewHint` | 查看全部页面，点击缩略图可快速跳转 | See all slides at a glance; click any thumbnail to jump |

重命名既有文案以提升语义清晰度：

| 字段 | 旧值 (zhCN) | 新值 (zhCN) | 旧值 (enUS) | 新值 (enUS) |
|------|-------------|-------------|-------------|-------------|
| `slideView` | 幻灯片视图 | 单页预览 | Slide View | Single Page |
| `gridView` | 缩略图视图 | 缩略图总览 | Grid View | Thumbnails |

### 5. 样式重新设计 (`styles/PptxPreview.css`)

- **设计语言对齐**：按钮配色与 `fv-html__fit-btn`、`fv-html__source-group` 对齐，使用 Slate 色板（`#0f172a` / `#475569` / `#64748b`）替代原 `var(--fv-foreground)` / `var(--fv-muted-foreground)`，确保深色模式下色彩一致性。
- **`.fv-pptx__mode-item`**：替代原 `.fv-pptx__mode-btn`，圆角 6px、内边距 `0 11px`、最小高度 32px，hover 时上浮阴影 + 蓝色边框（`rgba(37, 99, 235, 0.24)`），active 状态用蓝色描边 + 浅蓝背景。
- **`.fv-pptx__nav--hidden`**：grid 视图下隐藏导航，但保留 DOM 占位防止工具栏抖动。
- **缩放组 `.fv-pptx__zoom-group`**：改为 `inline-flex` 胶囊样式，与 `fv-html__source-group` 风格一致。
- **分页/全屏/缩放按钮**：尺寸从 32/36px 收敛为 30/32px，hover 时去除 `translateY(-1px)` 位移、改用边框 + 阴影反馈，过渡时间从 0.2s 缩短到 0.16s。
- **暗色模式**：每个新组件补充 `[data-fv-theme="dark"]` 变体（背景、边框、文字色、hover 反馈）。

### 6. 响应式断点扩展

| 断点 | 行为 |
|------|------|
| `max-width: 760px`（新增） | 模式切换按钮显示短标签，隐藏全称 |
| `max-width: 640px`（既有） | 工具栏内边距、按钮尺寸整体缩小 |
| `max-width: 420px`（新增） | 极窄屏只显示图标，连短标签也隐藏 |

### 7. 测试更新 (`__tests__/PptxPreview.lifecycle.test.tsx`)

将 grid 切换按钮的查找方式从 `getByTitle("缩略图视图")` 改为基于 DOM 结构的 CSS 选择器：

```ts
container.querySelector(".fv-pptx__mode-switch button[data-active='false']")
```

这样测试不再依赖本地化文案，i18n 文案修改不会导致测试失败，且与新的分段控件结构对齐。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/src/PptxPreview.tsx` | 工具栏三段式布局重构 + 分段控件 JSX |
| `packages/file-preview/src/icons.tsx` | 新增 `LayoutGridIcon`，移除 `Grid3X3Icon` 引用 |
| `packages/file-preview/src/core/i18n.ts` | 新增 5 个 locale 字段，重命名 `slideView` / `gridView` 文案 |
| `packages/file-preview/src/styles/PptxPreview.css` | 重写工具栏样式，新增分段控件、响应式断点、暗色模式变体 |
| `packages/file-preview/src/__tests__/PptxPreview.lifecycle.test.tsx` | grid 切换按钮查找方式改为 `data-active` 选择器 |

## 验证结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| TypeScript 类型检查 | `pnpm --filter @lamberl-lee/file-preview run typecheck` | ✅ 通过（`tsc --noEmit` 无输出） |
| 单元测试 | `pnpm --filter @lamberl-lee/file-preview run test` | ✅ 16 个测试文件，162 个用例全部通过（3.10s） |

## 提交记录

1. `feat(file-preview): redesign PPTX toolbar with segmented view-mode control` (commit `2f2c9320`)
