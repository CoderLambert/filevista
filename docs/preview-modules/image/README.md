# 图片预览模块

## 组件：ImagePreview

**文件路径**：`src/components/file-preview/ImagePreview.tsx`

**文件类型**：PNG, JPG/JPEG, GIF, BMP, WebP, ICO, AVIF

**核心依赖**：HTML5 原生（无外部依赖）

## 技术实现

### 渲染方案
- 使用 `URL.createObjectURL(file)` 创建 Object URL
- 通过 `<img>` 标签渲染
- 提供缩放、旋转控制

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 缩放 | CSS transform: scale() |
| 旋转 | CSS transform: rotate(90deg) |
| 重置 | 恢复默认缩放和旋转 |
| 适应窗口 | object-fit: contain |
| 拖拽平移 | 鼠标拖拽移动图片 |
| 滚轮缩放 | Ctrl + 滚轮调整缩放比例 |

### 数据流
```
File → URL.createObjectURL() → Object URL
    │
    ▼
<img src={url} /> 渲染
    │
    ▼
组件卸载时 URL.revokeObjectURL() 释放内存
```
