# PPTX 预览模块

## 组件：PptxPreview

**文件路径**：`src/components/file-preview/PptxPreview.tsx`

**文件类型**：PPTX (.pptx), PPT (.ppt)

**核心依赖**：`jszip@3.10.1`

## 技术实现

### 渲染方案
- PPTX 文件本质是 ZIP 压缩包，包含 XML 和媒体文件
- 使用 **JSZip** 解压 PPTX
- 解析 `ppt/presentation.xml`、`ppt/slides/slideN.xml`、`ppt/slideLayouts/` 等
- 从 XML 中提取文本、图片、形状信息
- 用 HTML/CSS 重新渲染幻灯片

### 核心流程

```
base64 content
    │
    ▼
JSZip.loadAsync() → ZIP 对象
    │
    ▼
读取 presentation.xml → 获取幻灯片顺序
    │
    ▼
遍历 slideN.xml → 提取文本/形状/图片
    │
    ▼
读取媒体文件 → blob URL
    │
    ▼
HTML 渲染幻灯片
```

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 幻灯片导航 | 左右箭头 + 幻灯片缩略图列表 |
| 文本提取 | 解析 `<a:t>` XML 节点 |
| 图片显示 | `ppt/media/` 中的图片转 blob URL |
| 形状识别 | 解析 `<p:sp>` 节点的位置和大小 |
| 母版布局 | 读取 slideLayouts 应用基础布局 |
| 备注 | 解析 `slideN.xml` 中的 notes |

### .ppt 格式处理
- PPT 是旧版二进制格式
- 提供友好提示建议转换为 PPTX
- 尝试以 PPTX 方式解析（部分 .ppt 可能被误标为 pptx）

### 已知限制
- 动画效果不支持
- 复杂形状（SmartArt、图表）还原有限
- 文本溢出和自动换行可能不精确
- 主题色/字体可能不完整还原
