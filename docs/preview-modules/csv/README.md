# CSV 预览模块

## 组件：CsvPreview

**文件路径**：`src/components/file-preview/CsvPreview.tsx`

**文件类型**：CSV (.csv)

**核心依赖**：原生 JavaScript（无外部依赖）

## 技术实现

### 渲染方案
- 纯 JS 解析 CSV 文本（支持逗号/制表符/分号分隔）
- 渲染为可排序、可搜索的 HTML 表格

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 自动分隔符检测 | 检测首行中逗号/制表符/分号的数量 |
| 列排序 | 点击表头排序（升序/降序/原始） |
| 搜索 | 全表文本搜索过滤 |
| 表头固定 | 首行作为固定表头 |
| 大文件 | 虚拟滚动支持 |

### CSV 解析逻辑
```typescript
// 自动检测分隔符
const firstLine = lines[0];
const commaCount = (firstLine.match(/,/g) || []).length;
const tabCount = (firstLine.match(/\t/g) || []).length;
const semicolonCount = (firstLine.match(/;/g) || []).length;
// 选择出现次数最多的作为分隔符
```

### 已知限制
- 不支持引号内包含分隔符的情况（简化解析）
- 不支持多行字段
- 编码检测有限（默认 UTF-8）
