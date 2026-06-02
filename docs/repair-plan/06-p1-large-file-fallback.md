# P1 - 大文件降级预览

## 背景

Code / JSON / Markdown / Text 文件如果很大，直接使用 Shiki 高亮可能导致浏览器卡顿。

## 已完成

所有修改已通过 `bun run build` 验证，无新增 TypeScript 错误。

### 涉及文件

```txt
src/components/file-preview/limits.ts                      (NEW)
src/components/file-preview/PlainTextLargePreview.tsx      (NEW)
src/components/file-preview/CodePreview.tsx                (MODIFIED)
src/components/file-preview/MarkdownPreview.tsx            (MODIFIED)
src/components/file-preview/ShikiSourceView.tsx            (MODIFIED)
src/components/file-preview/TextPreview.tsx                (MODIFIED)
```

### limits.ts

新增 `FILE_PREVIEW_LIMITS` 常量和 `shouldHighlight` / `formatFileSize` / `truncateContent` 辅助函数：

```ts
export const FILE_PREVIEW_LIMITS = {
  /** Skip Shiki highlighting above this byte size */
  SHIKI_MAX_FILE_SIZE: 500 * 1024, // 500 KB
  /** Skip Shiki highlighting above this line count */
  SHIKI_MAX_LINES: 5000,
  /** Skip code-block highlighting inside Markdown above this byte size */
  SHIKI_MAX_CODE_BLOCK_SIZE: 50 * 1024, // 50 KB
  /** Truncate display content to this size for plain-text fallback */
  MAX_DISPLAY_SIZE: 2 * 1024 * 1024, // 2 MB
} as const;
```

`shouldHighlight(content)` — 根据大小和行数判断是否跳过 Shiki

`formatFileSize(bytes)` — 格式化文件大小显示

`truncateContent(content, maxSize)` — 截断超大文件内容

### PlainTextLargePreview.tsx

纯文本降级预览组件，功能：
- 带行号的纯文本展示（与 Shiki 内置 fallback 样式一致）
- 工具栏：语言 badge、行数、文件大小、"大文件" 标签
- 自动换行 / 固定宽度切换
- 一键复制

### CodePreview.tsx

- 在 `doHighlight` 中增加 `shouldHighlight(displayContent)` 检查
- 超出阈值时跳过 Shiki，渲染区域使用 `PlainTextLargePreview` 替代

### ShikiSourceView.tsx

- 新增 `canHighlight` memo 计算
- `doHighlight` 中跳过 Shiki（直接 `setLoading(false)`）
- 渲染时根据 `canHighlight` 切换到 `PlainTextLargePreview`

### MarkdownPreview.tsx

- `ShikiPreContent` 中对单个代码块增加 `FILE_PREVIEW_LIMITS.SHIKI_MAX_CODE_BLOCK_SIZE` 检查
- 超大代码块跳过 Shiki，渲染为带 language badge 和 "大代码块" 标签的纯 `<pre><code>` 块
- 未使用缓存方案（当前场景下每个代码块独立 highlight，缓存收益有限且增加复杂度）

### TextPreview.tsx

- 传递 `language="text"` 给 `ShikiSourceView`，使其能正确显示语言标识

## 验收标准

| 文件          | 预期                             |
| ------------- | -------------------------------- |
| 100KB TS      | 正常 Shiki 高亮                  |
| 1MB TS        | 降级纯文本                       |
| 5MB JSON      | 降级纯文本                       |
| 10MB log      | 降级纯文本                       |
| 大 Markdown   | 代码块≤50KB 正常高亮，超限降级   |
