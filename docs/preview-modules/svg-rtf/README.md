# SVG & RTF 预览模块

## SvgPreview

**文件路径**：`src/components/file-preview/SvgPreview.tsx`

**文件类型**：SVG (.svg)

### 渲染方案
- SVG 文件作为文本内容传入
- 使用 `dangerouslySetInnerHTML` 直接注入 SVG 标记
- 提供缩放控制

### 核心特性
| 特性 | 实现方式 |
|------|---------|
| 渲染 | dangerouslySetInnerHTML 注入 |
| 缩放 | CSS transform: scale() |
| 全尺寸 | 恢复 SVG 原始尺寸 |
| 安全性 | 去除 `<script>` 标签 |

### 安全处理
- 移除 SVG 中的 `<script>` 标签
- 移除 `onload` 等事件属性
- 防止 XSS 攻击

---

## RtfPreview

**文件路径**：`src/components/file-preview/RtfPreview.tsx`

**文件类型**：RTF (.rtf)

### 渲染方案
- RTF 是纯文本标记格式
- 使用正则表达式提取纯文本内容
- 去除 RTF 控制字（`\b`, `\i`, `\par` 等）

### 核心特性
| 特性 | 实现方式 |
|------|---------|
| 文本提取 | 正则去除 RTF 控制字 |
| 段落还原 | `\par` → 换行 |
| 基本格式 | 粗体/斜体提示（不渲染样式） |

### 已知限制
- 仅提取纯文本，不还原格式
- 嵌入图片不支持
- 复杂 RTF 特性（表格、页眉页脚）不支持
