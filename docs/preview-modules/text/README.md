# 文本预览模块

## 组件：TextPreview

**文件路径**：`src/components/file-preview/TextPreview.tsx`

**文件类型**：纯文本 (.txt, .log, .env, .conf, .cfg, .gitignore 等)

**核心依赖**：原生 JavaScript（无外部依赖）

## 技术实现

### 渲染方案
- 直接显示文本内容，添加行号
- 支持自动换行和长行滚动

### 核心特性

| 特性 | 实现方式 |
|------|---------|
| 行号显示 | 逐行分割，左侧显示行号 |
| 自动换行 | `white-space: pre-wrap` |
| 搜索 | Ctrl+F 浏览器原生搜索 |
| 大文件 | 虚拟滚动支持 |
| 编码 | FileReader.readAsText() 默认 UTF-8 |

### 适用文件类型
- 配置文件：.env, .conf, .cfg
- 日志文件：.log
- 版本控制：.gitignore, .npmrc
- 通用文本：.txt, .text
