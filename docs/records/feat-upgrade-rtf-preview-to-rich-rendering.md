# feat: upgrade RTF preview to rich rendering with rtf.js

## 改动背景

当前 RTF 预览仅支持"文本提取预览"——通过正则表达式剥离 RTF 控制字来获取纯文本，无法呈现加粗、斜体、表格、标题等富文本格式。需要将 RTF 预览升级为 HTML 富文本渲染方案，同时保证安全隔离和失败降级。

## 改动方案

采用四层架构的纯前端渲染方案：

### 1. 主渲染：rtf.js
- 使用 `rtf.js` 将 RTF 原始文本解析为 DOM 元素（`Document(arrayBuffer).render()`）
- 将 DOM 元素序列化为 HTML 字符串

### 2. 安全清洗：DOMPurify
- 通过 DOMPurify 清洗 rtf.js 输出的 HTML
- 严格配置 `USE_PROFILES: { html: true }`，白名单指定安全标签和属性
- 移除所有脚本、事件处理器和危险 URL

### 3. 渲染隔离：iframe sandbox
- 使用 `<iframe srcDoc sandbox="allow-same-origin">` 隔离渲染
- `allow-same-origin` 仅允许同源访问（不包含 `allow-scripts`），阻止脚本执行
- iframe 内注入完整 HTML 文档，包含暗色模式适配样式

### 4. 自动降级：文本提取
- 保留原有的 `extractRtfText()` 正则解析函数作为降级方案
- 当 rtf.js 解析失败（复杂/损坏/不支持的 RTF）时自动降级为纯文本预览
- 向用户显示降级提示"富文本渲染不可用，已降级为纯文本预览"

### 数据流
```
RTF 文件 → useSourceText (readSourceAsText)
         → RtfPreview component
         → buildRtfHtml()
         → rtf.js Document.render() → HTMLElement[]
         → DOMPurify.sanitize() → 安全 HTML
         → buildIframeDoc() → 完整 HTML 文档
         → iframe srcDoc 渲染
         → [失败时] fallback → extractRtfText() → 纯文本段落
```

### 工程策略
- rtf.js 通过动态 `import()` 懒加载，不进入主 bundle
- 支持取消（useEffect cleanup）
- 纯浏览器端处理，不依赖后端服务

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `package.json` | 新增依赖 | 添加 rtf.js ^3.0.9、dompurify ^3.4.8 |
| `src/types/rtf-js.d.ts` | 新增文件 | rtf.js TypeScript 类型声明 |
| `src/components/file-preview/RtfPreview.tsx` | 重写 | 新增 buildRtfHtml()、buildIframeDoc()，iframe sandbox 渲染，文本降级 |
| `src/components/file-preview/demos.ts` | 新增内容 | 添加 example.rtf 演示文件 |
| `src/components/file-preview/support-status.ts` | 修改 | 更新 RTF 支持说明 |
| `README.md` | 修改 | 更新支持矩阵描述 |

## 验证结果

- ✅ ESLint 通过（`bun run lint` 无错误）
- ✅ TypeScript 编译通过（新增文件无类型错误，已有项目级别错误不受影响）
- ✅ 依赖安装成功（`bun add rtf.js dompurify @types/dompurify`）
- ✅ 预览模式：预览 / 源码双视图保持不变
