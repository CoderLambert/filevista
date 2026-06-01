# DOCX 预览模块

## 组件：DocxPreview

**文件路径**：`src/components/file-preview/DocxPreview.tsx`

**文件类型**：DOCX (.docx)

**核心依赖**：`docx-preview@0.3.7`

## 方案选型

### mammoth.js vs docx-preview 对比

| 评估维度 | mammoth.js | docx-preview |
|---------|-----------|--------------|
| **还原度** | ⭐⭐ 低 — 语义化 HTML，丢失大量格式 | ⭐⭐⭐⭐⭐ 高 — 逐像素还原 Word 文档 |
| **标题颜色** | ❌ 丢失，仅保留 h1-h6 语义标签 | ✅ 完整保留，包括主题色/自定义色 |
| **字体样式** | ⚠️ 部分保留（粗体/斜体） | ✅ 完整保留（字体族/大小/颜色/效果） |
| **段落布局** | ❌ 丢失（行距/缩进/对齐仅部分） | ✅ 精确还原 |
| **表格** | ⚠️ 基本表格，丢失边框/宽度/底色 | ✅ 完整样式还原 |
| **图片** | ⚠️ 内嵌图片 base64，丢失定位/大小 | ✅ 精确位置和尺寸 |
| **页眉页脚** | ❌ 不渲染 | ✅ 渲染 |
| **分页** | ❌ 不支持 | ✅ 逐页渲染 |
| **页边距** | ❌ 不保留 | ✅ 精确还原 |
| **批注/修订** | ❌ 不支持 | ✅ 可选渲染 |
| **包大小** | ~100KB (gzip) | ~74KB (gzip min) |
| **输出格式** | HTML 字符串 → dangerouslySetInnerHTML | DOM 操作 → 直接注入容器 |
| **兼容性** | 宽泛，支持 Node.js | 需要浏览器 DOM |
| **维护活跃度** | 低频更新 | 活跃维护 |

### 选择结果：**docx-preview** ✅

**核心理由**：
1. **还原度优先**：本项目定位是"尽可能还原"，docx-preview 逐页渲染，精确还原字体/颜色/布局/图片/分页
2. **标题颜色还原**：mammoth 将标题转为纯 `<h1>` 标签，丢失所有 Word 主题色和自定义颜色；docx-preview 保留原始样式
3. **分页支持**：docx-preview 按页渲染，视觉体验接近 Word
4. **表格完整性**：边框、底色、列宽全部保留
5. **浏览器环境**：本项目纯客户端渲染，docx-preview 的 DOM 依赖完全满足

**mammoth 的优势场景**（不适用于本项目）：
- Node.js 服务端渲染（docx-preview 不支持）
- 需要 SEO 友好的语义化 HTML 输出
- 只需提取文本内容，不关心视觉还原

## 技术实现

### 渲染方案
- 使用 **docx-preview** 的 `renderAsync()` 函数
- 将 DOCX 二进制数据直接渲染到 DOM 容器
- docx-preview 自动注入所需的 CSS 样式（主题、字体、布局）
- 按页渲染，每页为独立的 `<section>` 元素

### 核心流程

```
base64 content
    │
    ▼
atob() → Uint8Array → ArrayBuffer
    │
    ▼
renderAsync(arrayBuffer, container, styleContainer, options)
    │
    ▼
docx-preview 自动完成:
  ├── 解析 OOXML 结构
  ├── 提取主题/样式/字体
  ├── 解析文档内容（段落/表格/图片/页眉页脚）
  ├── 生成 CSS（主题色 + 字体 + 布局）
  └── 渲染到 DOM 容器（每页一个 <section>）
    │
    ▼
页面展示（白色页面 + 阴影，居中显示）
```

### 配置选项

```typescript
await renderAsync(arrayBuffer, container, undefined, {
  className: "docx",              // CSS 类名前缀
  inWrapper: true,                // 使用外层包裹容器
  ignoreWidth: false,             // 保留原始页面宽度
  ignoreHeight: false,            // 保留原始页面高度
  ignoreFonts: false,             // 渲染字体样式
  breakPages: true,               // 启用分页
  ignoreLastRenderedPageBreak: true,
  experimental: true,             // 启用实验性特性
  trimXmlDeclaration: true,
  useBase64URL: true,             // 图片使用 base64 URL
  renderHeaders: true,            // 渲染页眉
  renderFooters: true,            // 渲染页脚
  renderFootnotes: true,          // 渲染脚注
  renderEndnotes: true,           // 渲染尾注
});
```

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 分页渲染 | `breakPages: true`，每页一个 `<section>` |
| 字体/颜色 | docx-preview 从 DOCX 主题和样式中提取 |
| 图片 | `useBase64URL: true`，内嵌图片 base64 渲染 |
| 表格 | 完整边框、底色、列宽还原 |
| 页眉/页脚 | `renderHeaders/renderFooters: true` |
| 脚注/尾注 | `renderFootnotes/renderEndnotes: true` |
| 页数统计 | 渲染后查询 `.docx-wrapper > section` 数量 |

### 自定义样式覆盖

```css
/* 居中页面显示 */
.docx-preview-container .docx-wrapper {
  background: transparent !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* 页面阴影效果 */
.docx-preview-container .docx-wrapper > section.docx {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

/* 图片自适应 */
.docx-preview-container .docx-wrapper img {
  max-width: 100%;
  height: auto;
}
```

### 已知限制
- 复杂 SmartArt 图形可能不完整
- 嵌入式对象（OLE）不渲染
- 宏（VBA）不执行
- 极大文件（50MB+）渲染较慢
- 字体回退：若系统无文档中指定的字体，会使用替代字体
