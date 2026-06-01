# HTML & ZIP 预览模块

## HtmlPreview

**文件路径**：`src/components/file-preview/HtmlPreview.tsx`

**文件类型**：HTML (.html, .htm, .xhtml)

### 渲染方案
- 使用 **iframe sandbox** 隔离渲染 HTML 内容
- `srcdoc` 属性直接注入 HTML 内容
- Sandbox 限制：禁止脚本执行、表单提交、弹窗等

### 安全措施
```html
<iframe sandbox="allow-same-origin" srcdoc="..." />
```

- `sandbox` 属性限制 iframe 能力
- 禁止 JavaScript 执行（安全性）
- 禁止表单提交
- 禁止弹窗和导航

---

## ZipPreview

**文件路径**：`src/components/file-preview/ZipPreview.tsx`

**文件类型**：ZIP (.zip)

**核心依赖**：`jszip@3.10.1`

### 渲染方案
- 使用 **JSZip** 解压 ZIP 文件
- 展示文件列表（路径、大小、修改日期）
- 目录树结构可视化

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 文件列表 | 遍历 ZIP 条目，显示路径/大小 |
| 目录树 | 递归解析路径构建树形结构 |
| 大小统计 | 显示各文件解压后大小 |
| 文件类型图标 | 根据扩展名显示不同图标 |

### 已知限制
- 不支持解压下载单个文件
- 不支持预览 ZIP 内的文件
- 加密 ZIP 不支持
