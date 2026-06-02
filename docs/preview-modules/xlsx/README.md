# XLSX 预览模块

## 组件：XlsxPreview

**文件路径**：`src/components/file-preview/XlsxPreview.tsx`

**文件类型**：XLSX (.xlsx), XLS (.xls)

**核心依赖**：`exceljs@4.4.0`

## 技术实现

### 渲染方案
- 使用 **ExcelJS** 完整解析 Excel 工作簿
- 还原单元格值、样式、合并单元格、图片、超链接、注释
- HTML Table 渲染，支持虚拟滚动处理大文件

### 核心流程

```
base64 content
    │
    ▼
ExcelJS.Workbook.load(data)
    │
    ▼
遍历 worksheet
    │
    ├── getCellValues()     → 单元格值
    ├── getStyles()         → 字体/填充/边框/对齐
    ├── getMerges()         → 合并单元格范围
    ├── getImages()         → 图片（base64 blob URL）
    ├── getHyperlinks()     → 超链接
    └── getComments()       → 单元格注释
    │
    ▼
构建虚拟滚动网格
    │
    ▼
HTML Table 渲染
```

### 高级特性详解

#### 1. 单元格样式还原

| 样式类型 | 支持程度 | 实现方式 |
|---------|---------|---------|
| 字体（粗体/斜体/大小/颜色） | ✅ 完整 | `cell.font` → inline style |
| 背景填充（纯色/图案） | ✅ 大部分 | `cell.fill` → background-color |
| 边框（上下左右/颜色/样式） | ✅ 完整 | `cell.border` → border CSS |
| 文本对齐（水平/垂直/换行） | ✅ 完整 | `cell.alignment` → text-align/vertical-align |
| 数字格式（货币/百分比/日期） | ✅ 部分 | `cell.numFmt` → 自定义格式化 |
| 主题色/索引色 | ✅ | ExcelJS theme/indexed color 映射 |

#### 2. 合并单元格
- 解析 `worksheet._merges` 获取合并范围
- 只有左上角单元格有值，其余为 `null`
- 使用 `<td colSpan={...} rowSpan={...}>` 渲染合并

#### 3. 图片支持
- `worksheet.getImages()` 获取图片锚点
- `workbook.getImage(imageId)` 获取图片二进制数据
- 转换为 Blob URL 在 `<img>` 中显示
- 图片内嵌到对应单元格
- EMF/WMF 等不支持格式显示占位符

#### 4. 虚拟滚动

```
可见区域 = 容器高度 / 行高
渲染范围 = [startIndex - buffer, endIndex + buffer]
总行数可达 100,000+ 依然流畅
```

- **垂直虚拟滚动**：只渲染可视区域的行
- **水平虚拟滚动**：只渲染可视区域的列
- **缓冲区**：上下各渲染额外几行避免滚动闪烁

#### 5. 搜索功能
- 使用 `useDebounce` 防抖搜索
- 搜索文本和数字内容
- 高亮匹配单元格
- 显示匹配数量

#### 6. 超链接
- 检测 `cell.value.hyperlink` 属性（需 `v !== null` 防止 `in` 运算符报错）
- 渲染为可点击的 `<a>` 标签
- 外部链接新窗口打开

#### 7. 注释/批注
- 检测 `cell.note` 属性
- 单元格右上角显示红色三角标记
- Hover 弹出注释内容

### .xls 格式处理
- 检测文件头 magic bytes 判断 .xls 格式
- 提示用户 ".xls 是旧版格式，建议转换为 .xlsx"
- 不尝试解析 .xls（ExcelJS 不支持）

### 性能考量

| 场景 | 优化策略 |
|------|---------|
| 大文件（1万+行） | 虚拟滚动，只渲染可见区域 |
| 大量样式 | 样式缓存，避免重复计算 |
| 大量图片 | 图片懒加载，Blob URL 复用 |
| 多工作表 | 按需加载，切换时重新解析 |

### 已知限制
- 图表（Chart）不支持渲染
- 条件格式视觉还原有限
- 数据透视表显示为普通表格
- 非常复杂的自定义数字格式可能不准确
