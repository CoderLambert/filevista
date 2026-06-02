# JSON & 代码预览模块

## 组件：CodePreview

**文件路径**：`src/components/file-preview/CodePreview.tsx`

**配置文件**：`src/lib/shiki.ts`

**文件类型**：
- JSON (.json)
- 50+ 编程语言 (.js, .ts, .py, .rs, .go, .java, .c, .cpp, .css, .sql, .sh, .vue, .svelte 等)

**核心依赖**：`shiki@4.1.0` + `@shikijs/langs@4.1.0` + `@shikijs/themes@4.1.0`

## 方案选型

### react-syntax-highlighter (旧) vs Shiki (新)

| 评估维度 | react-syntax-highlighter | Shiki (fine-grained + JS engine) |
|---------|------------------------|----------------------------------|
| **渲染质量** | ⭐⭐⭐ highlight.js 正则匹配 | ⭐⭐⭐⭐⭐ VS Code TextMate 语法，精确还原 |
| **首屏体积** | ~400KB+（全部静态打包） | **0KB**（React.lazy + 按需加载） |
| **每语言成本** | 全部打包，无懒加载 | 4-20KB gzip（按需动态 import） |
| **亮/暗主题** | 写死 dark 主题 | ✅ CSS 变量双主题，零成本切换 |
| **主题切换** | 需重新渲染 + 换 CSS | CSS 变量切换，无需重新渲染 |
| **行号** | 组件 prop | 自定义 transformer + CSS `data-line` |
| **Token 粒度** | 粗（hljs-keyword 等） | 细（TextMate scope 逐 token 样式） |
| **WASM 依赖** | 无 | 无（使用 JS RegExp engine） |
| **懒加载** | 不支持 | ✅ 原生 ESM 动态 import |
| **维护活跃度** | 低频更新 | Anthony Fu 维护，VitePress/Nuxt/Astro 使用 |

### 选择结果：**Shiki** ✅

**核心理由**：
1. **VS Code 级别还原度** — TextMate 语法与 VS Code 完全一致
2. **真正的懒加载** — 语言/主题均为独立 async chunk，首屏零开销
3. **CSS 变量双主题** — `defaultColor: false` 输出 `--shiki-light`/`--shiki-dark`，无需重渲染
4. **无 WASM** — `createJavaScriptRegexEngine()` 消除 226KB gzip WASM 开销
5. **代码分割** — `createBundledHighlighter` + `createSingletonShorthands` 自动分块

## 技术架构

### 懒加载链路

```
用户点击代码文件
    │
    ▼
React.lazy(CodePreview) ← 组件层懒加载
    │
    ▼
codeToHtml(content, { lang, themes })
    │
    ▼
createSingletonShorthands 内部:
  ├── shiki/core (20KB gzip) ── 仅首次加载
  ├── createJavaScriptRegexEngine (5KB) ── 替代 WASM
  ├── @shikijs/langs/javascript (16KB gzip) ── 按需
  ├── @shikijs/themes/github-light (4KB gzip) ── 按需
  └── @shikijs/themes/github-dark (4KB gzip) ── 按需
    │
    ▼
总计首次: ~49KB gzip → 后续新语言仅 +4~20KB
```

### 核心：`src/lib/shiki.ts`

```typescript
import { createBundledHighlighter, createSingletonShorthands } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const createHighlighter = createBundledHighlighter({
  languages: {
    javascript: () => import("@shikijs/langs/javascript"),
    typescript: () => import("@shikijs/langs/typescript"),
    python: () => import("@shikijs/langs/python"),
    // ... 50+ 语言，每个都是独立的 dynamic import
  },
  themes: {
    "github-light": () => import("@shikijs/themes/github-light"),
    "github-dark": () => import("@shikijs/themes/github-dark"),
  },
  engine: () => createJavaScriptRegexEngine(), // 无 WASM
});

export const { codeToHtml } = createSingletonShorthands(createHighlighter);
```

### 双主题 CSS 变量

Shiki `defaultColor: false` 输出：
```html
<span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span>
```

CSS 切换规则：
```css
/* 亮色模式（默认） */
.shiki span { color: var(--shiki-light) !important; }

/* 暗色模式 */
.dark .shiki span { color: var(--shiki-dark) !important; }
```

**切换主题无需重新渲染**，仅通过 CSS 层切换。

### 行号 Transformer

```typescript
export function transformerLineNumbers(): ShikiTransformer {
  return {
    name: "line-numbers",
    line(lineProps, line) {
      lineProps["data-line"] = String(line + 1);
    },
  };
}
```

行号通过 CSS `content: attr(data-line)` 渲染，无 JS 开销。

### 语言检测

`getShikiLanguage(fileName)` 函数映射 50+ 文件扩展名 → Shiki 语言 ID：

| 分类 | 扩展名 |
|------|--------|
| Web | .js, .ts, .jsx, .tsx, .html, .css, .scss, .less, .vue, .svelte |
| Scripting | .py, .rb, .php, .pl, .lua, .r |
| Systems | .c, .cpp, .cs, .java, .go, .rs, .kt, .scala, .swift, .dart |
| Shell | .sh, .bash, .zsh, .ps1 |
| Data/Config | .json, .yml, .yaml, .toml, .ini, .sql, .graphql, .xml |
| Special | Dockerfile, Makefile, .env, .gitignore |

### 组件特性

| 特性 | 实现方式 |
|------|---------|
| VS Code 级语法高亮 | Shiki TextMate 语法 |
| 亮/暗主题自动切换 | CSS 变量双主题 |
| 行号 | Transformer + CSS `data-line` 属性 |
| 自动换行 | 可切换 wrap/nowrap |
| JSON 格式化 | `isJson` prop → JSON.parse + JSON.stringify(2) |
| 语言标签 | 工具栏显示语言名 |
| 行数统计 | 工具栏显示 |
| 复制按钮 | 复制原始内容到剪贴板 |
| 纯文本回退 | 高亮失败时降级为普通文本 + 行号 |
| React.lazy 懒加载 | 非代码文件不加载 Shiki |

### JSON 模式特殊处理

当 `isJson=true` 时：
1. 尝试 `JSON.parse(content)` 格式化
2. 解析失败时回退显示原始文本
3. 添加缩进（2 空格）
4. 使用 JSON 语法高亮

### 已知限制

- Shiki JS engine 在极少数边缘语法上可能不如 Oniguruma（可开启 `forgiving: true`）
- 每语言 chunk 较大（JS/TS ~16KB gzip vs hljs ~3KB gzip），但按需加载
- 超大文件（5000+ 行）渲染可能需要 ~200ms
- 首次加载需等待核心 + 语言 + 主题（~49KB gzip），后续秒开
