# P0 - 预览安全边界修复

## 背景

文件预览会处理用户本地内容，HTML / SVG / Markdown 是安全风险较高的格式。

当前 HTML 使用 iframe + Blob URL 是正确方向，但 sandbox 配置还可以收紧。

## 涉及文件

```txt
src/components/file-preview/HtmlPreview.tsx
src/components/file-preview/SvgPreview.tsx
src/components/file-preview/MarkdownPreview.tsx
```

## 任务 1：收紧 HTML iframe sandbox

修改前：

```tsx
<iframe
  src={blobUrl}
  sandbox="allow-same-origin"
/>
```

修改后：

```tsx
<iframe
  src={blobUrl}
  sandbox=""
  referrerPolicy="no-referrer"
  className="w-full h-full border-0"
  style={{ minHeight: "500px" }}
  title={fileName}
/>
```

## 任务 2：增加 HTML 安全模式

新增类型：

```ts
type HtmlSecurityMode = "safe" | "trusted";
```

默认：

```ts
const securityMode: HtmlSecurityMode = "safe";
```

根据模式设置 sandbox：

```ts
const sandbox =
  securityMode === "trusted"
    ? "allow-scripts allow-same-origin"
    : "";
```

默认不要开启 trusted。

## 任务 3：SVG 保持 img 渲染，不允许 innerHTML

SVG 当前应继续使用：

```tsx
<img src={svgUrl} alt={fileName} />
```

不要改成：

```tsx
<div dangerouslySetInnerHTML={{ __html: content }} />
```

## 任务 4：Markdown 不启用 rehypeRaw

不要增加：

```ts
rehypeRaw
```

除非后续明确做 HTML sanitize。

如果未来必须支持 Markdown 内联 HTML，必须先接入：

```txt
rehype-sanitize
```

## 验收标准

准备 HTML：

```html
<script>alert("xss")</script>
<h1>Hello</h1>
```

预期：

* alert 不执行
* 主页面不受影响

准备 SVG：

```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert("svg xss")</script>
  <circle cx="50" cy="50" r="40" />
</svg>
```

预期：

* 不执行 script
* 不污染主页面 DOM
