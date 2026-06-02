# P1 - XLSX 快速预览模式

## 背景

当前 XLSX 预览偏高保真，适合小型 Excel 文件。真实业务中的 Excel 可能行列很多、图片很多、样式复杂，全量解析会导致卡顿。

## 涉及文件

```txt
src/components/file-preview/XlsxPreview.tsx
src/components/file-preview/limits.ts
```

## 目标

增加两种模式：

```ts
type XlsxPreviewMode = "fast" | "fidelity";
```

## 模式说明

| 模式       | 说明                          |
| -------- | --------------------------- |
| fast     | 快速预览，只读取前 N 行，不渲染图片，不处理复杂样式 |
| fidelity | 高保真预览，保留样式、合并单元格、图片、批注等     |

## 任务 1：新增阈值

```ts
export const XLSX_PREVIEW_LIMITS = {
  fastModeRowLimit: 1000,
  largeFileSize: 10 * 1024 * 1024,
  maxFidelityFileSize: 30 * 1024 * 1024,
};
```

## 任务 2：新增 mode 状态

```ts
const [mode, setMode] = useState<XlsxPreviewMode>(() => {
  return fileSize > XLSX_PREVIEW_LIMITS.largeFileSize ? "fast" : "fidelity";
});
```

如果当前组件拿不到 `fileSize`，需要先把 `file.size` 透传到 `XlsxPreview`：

```tsx
<XlsxPreview
  content={file.content}
  fileName={file.name}
  fileSize={file.size}
/>
```

## 任务 3：快速模式限制行数

解析 worksheet 时：

```ts
const rowLimit =
  mode === "fast"
    ? XLSX_PREVIEW_LIMITS.fastModeRowLimit
    : worksheet.rowCount;
```

循环时：

```ts
for (let rowIndex = 1; rowIndex <= rowLimit; rowIndex++) {
  // parse row
}
```

## 任务 4：快速模式跳过图片

```ts
if (mode === "fidelity") {
  // parse images
}
```

## 任务 5：增加 UI 切换

工具栏增加：

```tsx
<button onClick={() => setMode("fast")}>快速模式</button>
<button onClick={() => setMode("fidelity")}>高保真模式</button>
```

当大文件选择高保真时提示：

```txt
当前文件较大，高保真模式可能导致浏览器卡顿。
```

## 任务 6：增加大文件提示

```tsx
{fileSize > XLSX_PREVIEW_LIMITS.largeFileSize && (
  <div className="px-4 py-2 text-xs bg-amber-50 text-amber-700 border-b">
    当前 Excel 文件较大，已默认使用快速预览模式。
  </div>
)}
```

## 验收标准

| 文件             | 预期     |
| -------------- | ------ |
| 小型 xlsx        | 默认高保真  |
| 大型 xlsx        | 默认快速模式 |
| 大型 xlsx 切高保真   | 有明确提示  |
| 含图片 xlsx 快速模式  | 不解析图片  |
| 含图片 xlsx 高保真模式 | 尽量显示图片 |
