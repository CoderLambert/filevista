# DOCX 预览模块

## 组件：DocxPreview

**文件路径**：`src/components/file-preview/DocxPreview.tsx`

**文件类型**：DOCX (.docx)

**核心依赖**：`mammoth@1.12.0`

## 技术实现

### 渲染方案
- 使用 **mammoth.js** 将 DOCX 转换为 HTML
- 在浏览器中直接渲染转换后的 HTML

### 核心流程

```
base64 content
    │
    ▼
atob() → Uint8Array → ArrayBuffer
    │
    ▼
mammoth.convertToHtml({ arrayBuffer })
    │
    ▼
{ value: htmlString, messages: warnings[] }
    │
    ▼
dangerouslySetInnerHTML 渲染
```

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 文本还原 | mammoth 段落转换 |
| 标题层级 | h1-h6 映射 |
| 列表 | 有序/无序列表 |
| 表格 | HTML table 转换 |
| 图片 | 内嵌图片 base64 渲染 |
| 粗体/斜体 | mammoth 内联样式转换 |
| 警告提示 | 显示 mammoth 转换警告信息 |

### 样式处理
- mammoth 默认将 Word 样式转为语义化 HTML
- 使用 Tailwind `prose` 排版类美化输出
- 部分复杂 Word 样式可能无法完美还原

### 已知限制
- 复杂排版（分栏、文本框）支持有限
- Word SmartArt 不支持
- 页眉/页脚不渲染
- 修订标记不显示
