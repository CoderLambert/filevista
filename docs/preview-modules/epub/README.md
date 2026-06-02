# EPUB 预览模块

## 组件：EpubPreview

**文件路径**：`src/components/file-preview/EpubPreview.tsx`

**文件类型**：EPUB (.epub)

**核心依赖**：`jszip@3.10.1`

## 技术实现

### 渲染方案
- EPUB 文件本质是 ZIP 压缩包，遵循 OCF (Open Container Format) 规范
- 使用 **JSZip** 解压 EPUB
- 手动解析 container.xml → content.opf → toc.ncx 等 XML 文件
- 提取章节 HTML 内容并通过 `dangerouslySetInnerHTML` 渲染

### 核心流程

```
base64 content
    │
    ▼
JSZip.loadAsync()
    │
    ├── META-INF/container.xml → 获取 OPF 路径
    │
    ├── content.opf
    │   ├── <metadata> → 书名、作者
    │   ├── <manifest> → 文件列表（id ↔ href 映射）
    │   └── <spine>    → 阅读顺序（idref 列表）
    │
    ├── toc.ncx → <navPoint> 目录树
    │
    ├── *.html/xhtml → 章节内容
    │
    ├── *.css → 样式表
    │
    └── images/* → 图片文件 → Blob URL
    │
    ▼
章节内容 + 图片 Blob URL + CSS → HTML 渲染
```

### 关键技术细节

#### 1. Manifest 解析（顺序无关属性提取）

**问题**：不同 EPUB 生成工具的 XML 属性顺序不一致
```xml
<!-- 情况 A：id 在 href 前 -->
<item id="ch1" href="chapter1.html" media-type="application/xhtml+xml"/>

<!-- 情况 B：href 在 id 前（如 calibre 生成） -->
<item href="chapter1.html" id="ch1" media-type="application/xhtml+xml"/>
```

**解决方案**：逐属性提取，而非依赖正则属性顺序
```typescript
const id = getAttr(attrs, "id");
const href = getAttr(attrs, "href");
```

#### 2. 目录（TOC）解析
- 解析 `toc.ncx` 中的 `<navPoint>` 递归结构
- 构建层级目录树（支持多级嵌套）
- 使用 TOC 标题作为章节名（最准确）
- 降级：h1/h2/h3 → `<title>` → "Chapter N"

#### 3. 图片处理
- ZIP 中的图片文件 → Blob URL
- 替换 HTML 中的相对路径为 Blob URL
- 支持多种映射：完整路径 / 文件名 / 大小写不敏感

#### 4. CSS 样式注入
- 保留书籍自带 CSS 样式表
- 注入全局覆盖规则防止水平溢出：
  ```css
  .epub-content * { max-width: 100% !important; overflow-wrap: break-word !important; }
  .epub-content img { max-width: 100% !important; height: auto !important; }
  ```

#### 5. 内部链接处理
- 章节间交叉引用（`<a href="chapter2.html#section">`）标记 `data-epub-link`
- 点击时查找目标章节并导航
- 外部链接正常打开

### UI 结构

```
┌──────────────────────────────────────┐
│ 书名 — 作者          [搜索] [目录]   │
├──────────┬───────────────────────────┤
│ 目录侧栏  │ ← 章节选择下拉 →        │
│ (可折叠)  │                          │
│          │ 章节标题                  │
│ 版权信息  │                          │
│ 前言     │ 章节内容...               │
│ 第1章    │                           │
│  1.1    │                           │
│  1.2    │                           │
│          │                           │
│          │ ← 上一章    下一章 →      │
└──────────┴───────────────────────────┘
```

### 搜索功能
- 全书文本搜索（去除 HTML 标签后搜索）
- 显示搜索结果所在章节 + 上下文摘要
- 点击结果跳转到对应章节

### 已知限制
- 嵌入字体不支持
- JavaScript 交互内容不执行
- 部分 EPUB3 特性（媒体叠加、fixed-layout）不支持
- 超大 EPUB（50MB+）首次加载较慢
