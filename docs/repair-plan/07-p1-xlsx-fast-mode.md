# P1 - XLSX 快速预览模式

## 背景

当前 XLSX 预览偏高保真，适合小型 Excel 文件。真实业务中的 Excel 可能行列很多、图片很多、样式复杂，全量解析会导致卡顿。

## 已完成

所有修改已通过 `bun run build` 验证，无新增 TypeScript 错误。

### 涉及文件

```txt
src/components/file-preview/limits.ts                (MODIFIED)
src/components/file-preview/FilePreviewRenderer.tsx  (MODIFIED)
src/components/file-preview/XlsxPreview.tsx          (MODIFIED)
```

### limits.ts

新增 `XLSX_PREVIEW_LIMITS` 常量：

```ts
export const XLSX_PREVIEW_LIMITS = {
  /** Fast mode renders at most this many rows */
  FAST_MODE_ROW_LIMIT: 1000,
  /** Files larger than this default to fast mode */
  LARGE_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  /** Files larger than this are not recommended for fidelity mode */
  MAX_FIDELITY_FILE_SIZE: 30 * 1024 * 1024, // 30 MB
} as const;
```

### FilePreviewRenderer.tsx

`case "xlsx"` 中增加 `fileSize={file.size}` 透传。

### XlsxPreview.tsx

**Props 扩展：** 新增 `fileSize: number`。

**模式类型：** `XlsxPreviewMode = "fast" | "fidelity"`，默认根据 `LARGE_FILE_SIZE` 阈值决定。

**`parseXlsx` 函数改造：** 接受 `mode` 参数，fast 模式下：

- 行数限制为 `FAST_MODE_ROW_LIMIT`（1000 行），但 `totalRows` 仍保留真实行数
- 跳过图片解析（`worksheet.getImages()` 不执行）
- 跳过样式提取（`extractStyle` 返回空对象）
- 合并单元格解析仍正常执行

**模式切换：** 工具栏增加"快速/高保真"切换按钮。超大文件（>30MB）切高保真时弹出确认提示。

**大文件提示：**

- fast 模式：显示黄色横幅，说明当前限制
- fidelity 模式：显示红色横幅，警告可能卡顿

**行数显示：** fast 模式下工具栏显示"显示前 1000 行 / 共 XXXXX 行 × XX 列"。

## 验收标准

| 文件              | 预期                               |
| ----------------- | ---------------------------------- |
| 小型 xlsx         | 默认高保真                         |
| 大于 10MB xlsx    | 默认快速模式                       |
| 大于 30MB xlsx 切高保真 | 弹确认提示                  |
| fast 模式         | 只显示前 1000 行，不解析图片       |
| fidelity 模式     | 尽量保留图片、样式、批注           |
| 切换模式          | 重新解析 workbook                  |
