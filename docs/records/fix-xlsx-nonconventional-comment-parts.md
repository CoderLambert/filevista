# fix: 兼容非约定路径的 XLSX 批注部件

## 改动背景

部分业务系统导出的 `.xlsx` 文件在预览时会失败，浏览器控制台输出：

```text
XLSX parse error: TypeError: Cannot read properties of undefined (reading 'comments')
    at WorkSheetXform.reconcile
    at XLSX.reconcile
    at XLSX.load
```

异常发生在 `ExcelJS.Workbook.xlsx.load()` 阶段，尚未进入 FileVista 的表格数据转换与渲染逻辑。因此，快速模式、高保真模式和 table/spreadsheet 渲染器都会受到影响。

## 根因分析

XLSX 是一个 OOXML ZIP 包。OOXML 允许关系目标使用绝对路径，也允许批注和 VML 部件使用不同的合法文件名；但 ExcelJS 4.4.0 加载批注时依赖固定命名约定：

- 批注 XML 只按 `xl/commentsN.xml` 建立索引
- 旧式批注 VML 只按 `xl/drawings/vmlDrawingN.vml` 建立索引
- 工作表关系中的 `Target` 预期为相对路径，例如 `../comments1.xml`
- 批注文本解析预期使用富文本 run：`<text><r><t>...</t></r></text>`

问题文件采用了另一组合法但不符合 ExcelJS 假设的结构：

```text
xl/comments/comment1.xml
xl/drawings/commentsDrawing1.vml
```

对应的工作表关系使用绝对目标：

```xml
<Relationship
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
  Target="/xl/comments/comment1.xml"
/>
```

ExcelJS 能读取工作表关系，却没有为上述批注路径建立索引。其 `WorkSheetXform.reconcile()` 随后直接访问缺失索引项的 `.comments` 属性，最终抛出 `undefined.comments`。此外，该文件的批注正文使用 `<text><t>...</t></text>`，即使只修正路径，ExcelJS 也会加载到空批注文本。

## 方案目标

1. 不修改 `node_modules` 或维护 ExcelJS 私有补丁
2. 不改变用户上传的原始文件，仅在内存中生成兼容副本
3. 正常 XLSX 继续走原有快速路径，不额外解压和重打包
4. 发生该类兼容错误时保留工作表值、样式和批注文本
5. 对批注引用缺失等局部元数据损坏采取降级策略，避免整份表格不可预览

## 改动方案

### 1. 精确识别 ExcelJS 批注关联异常

`readXlsxWorkbook()` 仍然先直接调用 ExcelJS。只有捕获到 `TypeError` 且错误消息指向读取 `comments` 时，才进入兼容归一化流程；其他解析错误保持原样抛出，避免掩盖文件损坏或未知问题。

处理流程如下：

```text
原始 ArrayBuffer
  → ExcelJS 正常加载
  → 成功：直接返回
  → comments 关联异常：归一化批注部件
  → 使用内存中的兼容副本重试 ExcelJS
```

### 2. 在内存中归一化 OOXML 批注部件

新增 `normalize-comments.ts`，使用现有的 JSZip 依赖完成以下处理：

- 扫描 `xl/worksheets/_rels/sheetN.xml.rels`
- 按 OPC 规则解析绝对和相对 `Target`
- 将批注 XML 映射到 ExcelJS 可识别的 `xl/commentsN.xml`
- 将 VML 映射到 `xl/drawings/vmlDrawingN.vml`
- 将工作表关系目标改写为 ExcelJS 预期的相对路径
- 将直接文本 `<text><t>...</t></text>` 包装为 `<text><r><t>...</t></r></text>`，保留批注正文
- 若批注或 VML 关系指向不存在的部件，则移除该可选关系，使工作表主体仍可预览

归一化不会删除或覆盖原始上传文件。新的 ZIP 只存在于当前解析过程的内存中。

### 3. 保持正常文件的性能路径

归一化仅在 ExcelJS 首次加载出现特定批注关联异常后执行。由 Excel 或 ExcelJS 正常生成的工作簿不会重复解压、复制部件或重新压缩，因此常规预览性能不受影响。

工作簿主题颜色仍从原始 buffer 并行读取，与原有加载逻辑保持一致。

### 4. 增加回归测试

回归测试先使用 ExcelJS 生成标准工作簿，再将测试 ZIP 改写成问题文件的结构：

- 绝对批注关系路径
- `xl/comments/comment1.xml` 非约定批注位置
- `commentsDrawing1.vml` 非约定 VML 名称
- `<text><t>...</t></text>` 简单批注文本

测试断言兼容加载后：

- 单元格值未丢失
- 批注文本能够正确读取

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/src/excel/read-workbook.ts` | 修改 — 捕获特定 ExcelJS 批注关联异常，归一化后重试 |
| `packages/file-preview/src/excel/normalize-comments.ts` | 新增 — OOXML 批注路径、VML 和文本结构兼容层 |
| `packages/file-preview/src/excel/normalize-comments.test.ts` | 新增 — 非约定批注部件回归测试 |
| `docs/records/fix-xlsx-nonconventional-comment-parts.md` | 新增 — 本次修复记录 |

## 验证结果

| 检查项 | 结果 |
|--------|------|
| 问题文件源码入口加载 | ✅ 1 个工作表，6 行，142 列 |
| 问题文件批注读取 | ✅ `A1`、`N1` 等批注正文正常保留 |
| `pnpm typecheck` | ✅ 通过 |
| `pnpm test` | ✅ 14 个测试文件、151 个测试用例全部通过 |
| `pnpm build` | ✅ ESM 与类型声明构建通过 |

## 适用边界

- 本方案面向 OOXML `.xlsx` 中传统批注（comments + VML）的路径和文本兼容问题
- 旧版二进制 `.xls` 仍不在 ExcelJS 的支持范围内
- 未知的 ExcelJS 解析异常不会自动进入该兼容分支，仍会按原错误上报
- 归一化是预览时的内存转换，不会把兼容后的文件写回用户磁盘
