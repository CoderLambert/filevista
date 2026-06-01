# JSON & 代码预览模块

## 组件：CodePreview

**文件路径**：`src/components/file-preview/CodePreview.tsx`

**文件类型**：
- JSON (.json)
- 30+ 编程语言 (.js, .ts, .py, .rs, .go, .java, .c, .cpp, .css, .sql, .sh 等)

**核心依赖**：`react-syntax-highlighter@15.6.1`

## 技术实现

### 渲染方案
- **react-syntax-highlighter** (Prism 引擎) 进行语法高亮
- JSON 模式额外提供格式化功能
- 自动语言检测基于文件扩展名

### 语言检测映射

```
文件扩展名 → Prism 语言
─────────────────────
.js/.jsx   → javascript
.ts/.tsx   → typescript
.py        → python
.rs        → rust
.go        → go
.java      → java
.c/.cpp    → c/cpp
.css/.scss → css/scss
.sql       → sql
.sh/.bash  → bash
.yml/.yaml → yaml
.xml       → xml
.html      → html
.json      → json (isJson=true 模式)
```

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 语法高亮 | Prism-based，oneDark 主题 |
| 行号显示 | `showLineNumbers={true}` |
| JSON 格式化 | `isJson` prop → JSON.parse + JSON.stringify(pretty) |
| 自动换行 | `wrapLines` 配置 |
| 语言标签 | 文件名显示在顶部 |
| 复制按钮 | 复制原始内容到剪贴板 |

### JSON 模式特殊处理
当 `isJson=true` 时：
1. 尝试 `JSON.parse(content)` 格式化
2. 解析失败时回退显示原始文本
3. 添加缩进（2 空格）
4. 使用 JSON 语法高亮
