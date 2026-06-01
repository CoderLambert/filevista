# PDF 预览模块

## 组件：PdfPreview

**文件路径**：`src/components/file-preview/PdfPreview.tsx`

**文件类型**：PDF (.pdf)

**核心依赖**：`pdfjs-dist@4.4.168`

## 技术实现

### 渲染方案
- 使用 **pdfjs-dist** 在 Canvas 上逐页渲染 PDF
- 不使用 Chrome 内置 PDF 查看器（避免 iframe 安全限制）
- 每一页 PDF 渲染为独立的 `<canvas>` 元素

### 核心流程

```
base64 content
    │
    ▼
atob() → Uint8Array
    │
    ▼
pdfjsLib.getDocument({ data: bytes })
    │
    ▼
PDFDocumentProxy
    │
    ▼ 遍历每页
page.render({ canvasContext, viewport })
    │
    ▼
Canvas 绘制完成
```

### 关键特性

| 特性 | 实现方式 |
|------|---------|
| 分页渲染 | 遍历 `pdf.numPages`，每页创建独立 Canvas |
| 缩放 | `viewport.scale` 参数控制，默认 1.5x |
| 页面导航 | 上一页/下一页按钮 + 页码跳转 |
| 全页展示 | 可切换"显示全部页面"模式 |
| Worker 配置 | `GlobalWorkerOptions.workerSrc` 设置 PDF Worker |

### 性能优化
- 延迟渲染：只渲染当前可见页
- Canvas 尺寸自适应容器宽度
- 使用 `devicePixelRatio` 适配高分屏

### 已知限制
- 超大 PDF（100+ 页）可能较慢
- PDF 表单交互不支持
- PDF 内嵌 JavaScript 不执行
