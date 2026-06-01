# Markdown 预览模块

## 组件：MarkdownPreview

**文件路径**：`src/components/file-preview/MarkdownPreview.tsx`

**文件类型**：Markdown (.md, .mdx, .markdown)

**核心依赖**：`react-markdown@10.1.0`, `remark-gfm@4.0.1`

## 技术实现

### 渲染方案
- 使用 **react-markdown** 将 Markdown 文本转为 React 组件
- **remark-gfm** 插件支持 GitHub Flavored Markdown（表格、删除线、任务列表等）
- 代码块使用 **react-syntax-highlighter** 进行语法高亮

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| GFM 表格 | remark-gfm 自动支持 |
| 代码高亮 | react-syntax-highlighter (oneDark 主题) |
| 链接 | 外部链接在新标签页打开 |
| 图片 | base64 或 URL 引用均可显示 |
| 删除线 | remark-gfm 扩展 |
| 任务列表 | `- [ ]` / `- [x]` 语法 |

### 样式
- Tailwind `prose` 排版类
- 暗色模式支持 `dark:prose-invert`
- 代码块深色主题
