# Markdown 预览模块

## 组件：MarkdownPreview

**文件路径**：`src/components/file-preview/MarkdownPreview.tsx`

**文件类型**：Markdown (.md, .mdx, .markdown)

**核心依赖**：`react-markdown@10.1.0`, `remark-gfm@4.0.1`, `shiki@4.1.0`

## 技术实现

### 渲染方案
- 使用 **react-markdown** 将 Markdown 文本转为 React 组件
- **remark-gfm** 插件支持 GitHub Flavored Markdown（表格、删除线、任务列表等）
- 代码块使用 **Shiki** 进行语法高亮（与 CodePreview 共享同一引擎）

### 代码块高亮架构

Markdown 中的 fenced code blocks（带语言标注的）自动使用 Shiki 高亮：

```
Markdown 文件
    │
    ▼
react-markdown + remark-gfm 解析
    │
    ▼
自定义 pre 组件 (ShikiPreBlock)
  ├── 检测 <code class="language-xxx"> 子元素
  ├── 提取语言标识和代码内容
  │
  ▼
ShikiPreContent 异步组件
  ├── highlightCode(code, language) ← 复用 src/lib/shiki.ts
  ├── 输出 CSS 变量双主题 HTML
  └── 降级：加载失败时显示纯文本代码块
    │
    ▼
渲染结果：语言标签 + 复制按钮 + 语法高亮 + 行号
```

### 懒加载设计

MarkdownPreview 整体通过 `React.lazy()` 懒加载：

```typescript
// FilePreviewRenderer.tsx
const MarkdownPreview = lazy(() =>
  import("./MarkdownPreview").then((m) => ({ default: m.MarkdownPreview }))
);
```

**原因**：MarkdownPreview 引入 Shiki（`highlightCode`），属于重度依赖。非 Markdown 文件不会加载任何 Shiki 代码。

**加载链路**：
1. 用户点击 .md 文件 → `React.lazy` 加载 MarkdownPreview 组件（~2KB gzip）
2. Markdown 渲染，遇到 fenced code block → 异步调用 `highlightCode()`
3. Shiki 核心 + 语言 + 主题按需加载（~49KB gzip 首次，后续语言 +4~20KB）
4. 无代码块的 Markdown 文件：只加载 react-markdown + remark-gfm，不加载 Shiki

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| GFM 表格 | remark-gfm 自动支持 |
| 代码块语法高亮 | Shiki（VS Code TextMate 语法） |
| 亮/暗主题自动切换 | CSS 变量双主题，零成本切换 |
| 代码行号 | Transformer + CSS `data-line` 属性 |
| 语言标签 | 代码块右上角 badge |
| 复制按钮 | 悬停显示，点击复制代码内容 |
| 行内代码 | 保持 prose 默认样式 |
| 无语言代码块 | 渲染为普通 `<pre><code>` |
| 高亮加载中 | 先显示纯文本，高亮完成后替换 |
| React.lazy 懒加载 | 非 Markdown 文件不加载组件 |

### 样式
- Tailwind `prose` 排版类
- 暗色模式支持 `dark:prose-invert`
- Shiki 代码块使用 CSS 变量双主题（与 CodePreview 一致）
- 代码块标题栏：语言 badge + 悬停复制按钮

### 与 CodePreview 的复用

MarkdownPreview 和 CodePreview 共享 `src/lib/shiki.ts` 中的 `highlightCode` 函数：

| 共享项 | 说明 |
|--------|------|
| `highlightCode()` | 统一的高亮入口，双主题输出 |
| `transformerLineNumbers()` | 行号 transformer |
| `getShikiLanguage()` | 文件扩展名 → 语言 ID 映射 |
| 双主题 CSS 变量 | `--shiki-light` / `--shiki-dark` |
| Shiki singleton | 同一 highlighter 实例，语言加载可复用 |

**优势**：用户先打开代码文件（加载 Shiki 核心 + 某语言），再打开 Markdown 文件中的同语言代码块，无需重新加载语言 grammar。
