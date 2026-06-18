# feat: XLSX 分页、大文件模式选择对话框与图标增强

## 改动背景

XLSX 预览模块在实际使用中发现以下问题：
1. **大文件体验差**：打开大文件时直接全量渲染，导致浏览器卡顿，用户无法选择更轻量的预览模式
2. **超大表格截断**：原 `MAX_RENDER_ROWS` 直接截断超过 1000 行的数据，用户无法查看后续内容
3. **单元格图片渲染粗糙**：图片布局松散，缺少尺寸约束和信息展示
4. **文件大小阈值偏保守**：`LARGE_FILE_SIZE`（10MB）和 `MAX_FIDELITY_FILE_SIZE`（30MB）阈值偏低，许多中等文件被误判为大文件

此外，`icons.tsx` 中的 icon 子元素处理方式存在 React key 警告隐患，需一并清理。

## 改动方案

### 1. 大文件模式选择对话框 (`XlsxPreview.tsx`)

- 检测到大文件时，首次加载弹出模式选择对话框（而非直接开始渲染）
- 提供两种模式：
  - **快速模式**：仅渲染前 1000 行，跳过图片和复杂样式
  - **高保真模式**：保留样式、图片、批注（超大文件会 `window.confirm` 二次确认）
- 含嵌入图片的 XLSX 文件强制使用 table 渲染器（spreadsheet 渲染器不支持图片）

### 2. 表格分页 (`XlsxTablePreview.tsx`)

- 移除原 `MAX_RENDER_ROWS` 截断逻辑，改为全量分页
- 分页控件：首页 / 上一页 / 页码 / 下一页 / 末页
- 可配置每页行数：50 / 100 / 200 / 500
- 切换工作表和搜索时自动回到第一页

### 3. 单元格图片渲染增强 (`XlsxTablePreview.tsx` + `XlsxPreview.css`)

- 图片容器改为 CSS Grid 布局（`repeat(auto-fill, minmax(120px, 1fr))`）
- 新增 `fv-xlsx__cell-image-wrapper`：卡片式设计，带 hover 浮起效果和边框高亮
- 图片显示尺寸约束：最大 200×200，最小 40×40，保持宽高比
- 新增尺寸标签（`fv-xlsx__cell-image-info`）展示原始分辨率
- 不支持格式的占位符改为 2px 虚线边框 + 更大图标

### 4. 文件大小阈值调整 (`limits.ts`)

| 阈值 | 旧值 | 新值 |
|------|------|------|
| `LARGE_FILE_SIZE` | 10 MB | 45 MB |
| `MAX_FIDELITY_FILE_SIZE` | 30 MB | 50 MB |

### 5. i18n 消息 (`core/i18n.ts`)

新增中英文文案：
- 模式选择：`modeSelectionTitle` / `modeSelectionDesc` / `modeSelectionFastMode` / `modeSelectionFidelityMode` 等
- 分页：`paginationInfo` / `paginationPage` / `paginationPageSize` 等

### 6. Icon 子元素重构 (`icons.tsx`)

- `icon()` 帮助函数签名从 `(...children: ReactNode[])` 改为 `(children: ReactNode)`
- 移除 `Children.toArray()` 包装，每个 Icon 改为传入单个 React Fragment
- 消除 React key 警告，移除对 `react` 的 `Children` 导入依赖

### 7. 调试日志清理

移除开发阶段遗留的 `console.log` 调试语句（15 处），保留必要的 `console.warn`/`console.error`。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/src/XlsxPreview.tsx` | 新增模式选择对话框 + 图片文件强制 table 渲染 |
| `packages/file-preview/src/XlsxTablePreview.tsx` | 分页功能 + 图片渲染增强 |
| `packages/file-preview/src/core/i18n.ts` | 新增模式选择和分页 i18n 消息 |
| `packages/file-preview/src/icons.tsx` | Icon 子元素处理重构 |
| `packages/file-preview/src/limits.ts` | 调高大文件阈值 |
| `packages/file-preview/src/styles/XlsxPreview.css` | 分页、图片 wrapper、模式对话框样式 |
| `packages/file-preview/test-transform.ts` | 新增图片提取测试脚本 |
| `packages/file-preview/test-xlsx-images.ts` | 新增图片提取测试脚本 |
| `test-demo-images.js` | 新增 demo 图片测试脚本 |
| `test-xlsx-image.ts` | 新增图片提取测试脚本 |

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `pnpm run typecheck` | ✅ 通过 |
| `pnpm run test` | ✅ 11 个测试文件，117 个测试用例全部通过 |

## 提交记录

1. `feat(xlsx): add large file mode selection dialog and increase size limits`
2. `feat(xlsx): add table pagination and enhance cell image rendering`
3. `refactor(icons): simplify icon children to single Fragment`
