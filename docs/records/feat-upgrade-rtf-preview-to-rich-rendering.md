# feat: upgrade RTF preview to rich rendering with rtf.js

## 改动背景

当前 RTF 预览仅支持"文本提取预览"——通过正则表达式剥离 RTF 控制字来获取纯文本，无法呈现加粗、斜体、表格、标题等富文本格式。需要将 RTF 预览升级为 HTML 富文本渲染方案，同时保证安全隔离和失败降级。

## 改动方案

采用四层架构的纯前端渲染方案：

### 1. 主渲染：rtf.js (官方 bundle 方式)

- 通过动态加载 `WMFJS.bundle.min.js`、`EMFJS.bundle.min.js`、`RTFJS.bundle.min.js` 三个 bundle 脚本
- Bundle 脚本在 `window` 上暴露 `RTFJS`、`WMFJS`、`EMFJS` 全局变量
- 使用 `new RTFJS.Document(buffer)` 解析 RTF 原始 ArrayBuffer，再调用 `doc.render()` 获取 DOM 元素
- 将 DOM 元素序列化为 HTML 字符串
- **关键**：必须使用原始 ArrayBuffer，不可先将 RTF 转为 string 再重新编码，否则会破坏字节语义

### 2. 安全清洗：DOMPurify

- 通过 DOMPurify 清洗 rtf.js 输出的 HTML
- 配置 `USE_PROFILES: { html: true, svg: true, svgFilters: true }`，白名单指定安全标签和属性
- 移除所有脚本、iframe、object、embed 等危险元素

### 3. 渲染隔离：iframe sandbox

- 使用 `<iframe srcDoc sandbox="">` 隔离最终静态 HTML 预览
- `sandbox=""`（空属性）阻止一切脚本执行，仅展示渲染结果
- rtf.js 渲染在主页面完成，不在 iframe 内执行
- iframe 内注入完整 HTML 文档，包含暗色模式适配样式

### 4. 自动降级：文本提取

- 保留原有的 `extractRtfText()` 正则解析函数作为降级方案
- 当 rtf.js 解析失败（复杂/损坏/不支持的 RTF）时自动降级为纯文本预览
- 向用户显示降级提示"富文本渲染不可用，已降级为纯文本预览"
- 开发模式下 console.error 输出真实错误信息便于调试

### 数据流

```
RTF 文件 → RtfPreviewAdapter (readSourceAsArrayBuffer + readSourceAsTextSafe)
         → RtfPreview component (buffer + rawText)
         → buildRtfHtml()
         → loadRtfJsGlobals() → 动态加载 WMFJS/EMFJS/RTFJS bundles
         → new RTFJS.Document(buffer).render() → HTMLElement[]
         → DOMPurify.sanitize() → 安全 HTML
         → buildIframeDoc() → 完整 HTML 文档
         → iframe srcDoc (sandbox="") 渲染
         → [失败时] fallback → extractRtfText(rawText) → 纯文本段落
```

### 工程策略

- rtf.js bundles 通过 Vite `?url` 导入，在 `document.head` 动态插入 `<script>` 标签加载
- 单例模式保证 bundles 只加载一次（`loadingPromise` 共享）
- 支持 useEffect cleanup 取消
- 纯浏览器端处理，不依赖后端服务

## 改动文件

| 文件                                            | 改动类型 | 说明                                                                 |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `package.json`                                  | 新增依赖 | 添加 rtf.js ^3.0.9、dompurify ^3.4.8                                 |
| `src/types/rtf-js.d.ts`                         | 新增文件 | rtf.js TypeScript 类型声明                                           |
| `src/types/assets.d.ts`                         | 新增文件 | `*.js?url` Vite asset module 类型声明                                |
| `src/components/file-preview/rtf/load-rtfjs.ts` | 新增文件 | rtf.js bundle 动态加载器（单例模式）                                 |
| `src/components/file-preview/RtfPreview.tsx`    | 重写     | ArrayBuffer 渲染，bundle 调用，iframe sandbox，文本降级，错误日志    |
| `src/components/file-preview/preview-adapters/RtfPreviewAdapter.tsx` | 重写 | 改用 readSourceAsArrayBuffer 保留原始字节 |
| `src/components/file-preview/demos.ts`          | 新增内容 | 添加 example.rtf 演示文件                                            |
| `src/components/file-preview/support-status.ts` | 修改     | 更新 RTF 支持说明                                                    |
| `README.md`                                     | 修改     | 更新支持矩阵描述                                                     |

## 验证结果

- ✅ ESLint 通过（`bun run lint` 无错误）
- ✅ TypeScript 编译通过（新增文件无类型错误）
- ✅ 依赖安装成功（`bun add rtf.js dompurify @types/dompurify`）
- ✅ 预览模式：预览 / 源码双视图保持不变
