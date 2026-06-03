# FileVista 14 阶段开发执行文档：Plugin Renderer 收口治理与验证矩阵

## 1. 阶段目标

14 阶段不继续新增文件预览类型，也不重构现有 Office / ZIP / EPUB 渲染逻辑。

本阶段核心目标是完成 Plugin Renderer 的收口治理：

```txt
1. 明确哪些文件类型已经完成 Plugin Renderer 迁移
2. 明确哪些文件类型属于降级支持
3. 明确哪些文件类型真正不支持预览
4. 修正 Plugin Renderer 未命中 plugin 时的提示语义
5. 建立可回归的文件类型验证矩阵
6. 确保开发环境显示 plugin debug bar，生产环境不显示
```

当前阶段的重点不是继续做渲染能力，而是让已有迁移结果变得：

```txt
可验证
可回归
可维护
可排查
```

---

## 2. 当前阶段边界

### 2.1 本阶段要做

```txt
新增文件类型支持状态矩阵
修正 Not Migrated Yet / Preview Not Available 的显示规则
新增验证矩阵文档
检查 debug bar 是否只在开发环境显示
整理手动回归测试流程
```

### 2.2 本阶段不做

```txt
不新增新的预览类型
不重构 Plugin Registry
不移除 Legacy Renderer
不重写 DOCX / PPTX / XLSX 内部解析逻辑
不重构 ZIP / EPUB 为 source 模式
不处理旧版 Office 二进制格式的完整预览
不引入新的大型依赖
不做性能深度优化
```

---

## 3. 需要修改的文件

### 3.1 新增文件

```txt
src/components/file-preview/support-status.ts
docs/preview-plugin-validation-matrix.md
```

### 3.2 修改文件

```txt
src/components/file-preview/PluginPreviewRenderer.tsx
src/app/page.tsx
```

### 3.3 不建议修改的文件

```txt
src/components/file-preview/core/plugin.ts
src/components/file-preview/core/registry.ts
src/components/file-preview/DocxPreview.tsx
src/components/file-preview/PptxPreview.tsx
src/components/file-preview/XlsxPreview.tsx
src/components/file-preview/ZipPreview.tsx
src/components/file-preview/EpubPreview.tsx
```

原因：

```txt
14 阶段是收口治理，不是继续扩大渲染器实现范围。
这些组件目前已经可以通过 Adapter 接入 Plugin Renderer，不需要继续改内部逻辑。
```

---

## 4. 新增支持状态矩阵

新增文件：

```txt
src/components/file-preview/support-status.ts
```

完整内容如下：

```ts
import type { FileType } from "./utils";

export type PreviewSupportStatus =
  | "plugin-supported"
  | "legacy-only"
  | "degraded"
  | "unsupported";

export type RendererSupportState = "supported" | "degraded" | "unsupported";

export interface PreviewSupportMeta {
  fileType: FileType;
  status: PreviewSupportStatus;
  legacyRenderer: RendererSupportState;
  pluginRenderer: RendererSupportState;
  pluginId: string | null;
  note?: string;
}

export const PREVIEW_SUPPORT_MATRIX: Record<FileType, PreviewSupportMeta> = {
  pdf: {
    fileType: "pdf",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.pdf",
  },

  code: {
    fileType: "code",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.source-code",
  },

  json: {
    fileType: "json",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.source-code",
    note: "JSON currently reuses the source-code plugin.",
  },

  text: {
    fileType: "text",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.text",
  },

  image: {
    fileType: "image",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.image",
  },

  audio: {
    fileType: "audio",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.audio",
  },

  video: {
    fileType: "video",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.video",
  },

  svg: {
    fileType: "svg",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.svg",
  },

  csv: {
    fileType: "csv",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.csv",
  },

  markdown: {
    fileType: "markdown",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.markdown",
  },

  html: {
    fileType: "html",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.html",
  },

  rtf: {
    fileType: "rtf",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.rtf",
  },

  zip: {
    fileType: "zip",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.zip",
  },

  epub: {
    fileType: "epub",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.epub",
  },

  docx: {
    fileType: "docx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.docx",
  },

  pptx: {
    fileType: "pptx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.pptx",
  },

  xlsx: {
    fileType: "xlsx",
    status: "plugin-supported",
    legacyRenderer: "supported",
    pluginRenderer: "supported",
    pluginId: "builtin.xlsx",
  },

  doc: {
    fileType: "doc",
    status: "degraded",
    legacyRenderer: "degraded",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: ".doc is a legacy Word binary format. It should not be routed to the DOCX plugin.",
  },

  ppt: {
    fileType: "ppt",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: ".ppt is a legacy PowerPoint binary format. Please convert it to .pptx.",
  },

  xls: {
    fileType: "xls",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
    note: ".xls is a legacy Excel binary format. Please convert it to .xlsx.",
  },

  unknown: {
    fileType: "unknown",
    status: "unsupported",
    legacyRenderer: "unsupported",
    pluginRenderer: "unsupported",
    pluginId: null,
  },
};

export function getPreviewSupportMeta(fileType: FileType): PreviewSupportMeta {
  return PREVIEW_SUPPORT_MATRIX[fileType];
}

export function isPluginSupportedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "plugin-supported";
}

export function isUnsupportedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "unsupported";
}

export function isDegradedFileType(fileType: FileType): boolean {
  return PREVIEW_SUPPORT_MATRIX[fileType].status === "degraded";
}
```

---

## 5. 修改 PluginPreviewRenderer

修改文件：

```txt
src/components/file-preview/PluginPreviewRenderer.tsx
```

### 5.1 新增 import

在 import 区域新增：

```ts
import { getPreviewSupportMeta } from "./support-status";
```

### 5.2 替换未命中 plugin 的逻辑

找到当前逻辑：

```tsx
if (!PreviewComponent || !plugin) {
  return (
    <UnsupportedPluginPreview
      fileType={file.fileType}
      title="Not Migrated Yet"
      description={`This file type (${file.fileType}) has not been migrated to the plugin renderer yet. You can switch back to Legacy Renderer to preview it.`}
    />
  );
}
```

替换为：

```tsx
if (!PreviewComponent || !plugin) {
  const support = getPreviewSupportMeta(file.fileType);

  if (support.status === "legacy-only") {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        title="Not Migrated Yet"
        description={`This file type (${file.fileType}) is currently only available in Legacy Renderer.`}
      />
    );
  }

  if (support.status === "degraded") {
    return (
      <UnsupportedPluginPreview
        fileType={file.fileType}
        title="Preview Not Available"
        description={
          support.note ??
          `This file type (${file.fileType}) only has degraded legacy support and is not available in Plugin Renderer.`
        }
      />
    );
  }

  return (
    <UnsupportedPluginPreview
      fileType={file.fileType}
      title="Preview Not Available"
      description={
        support.note ??
        `This file type (${file.fileType}) cannot be previewed by the plugin renderer.`
      }
    />
  );
}
```

### 5.3 修改后的语义

修改后，Plugin Renderer 下的提示语义应为：

```txt
plugin-supported 类型未命中 plugin：
说明 registry 或 plugin 注册有问题，需要排查

legacy-only 类型未命中 plugin：
显示 Not Migrated Yet

degraded 类型未命中 plugin：
显示 Preview Not Available，并说明这是降级类型

unsupported 类型未命中 plugin：
显示 Preview Not Available
```

当前阶段重点验证：

```txt
.doc      不应显示 Not Migrated Yet
.ppt      不应显示 Not Migrated Yet
.xls      不应显示 Not Migrated Yet
unknown   不应显示 Not Migrated Yet
```

---

## 6. 检查 debug bar 显示规则

修改或检查文件：

```txt
src/app/page.tsx
```

找到 Plugin Renderer 渲染位置，确认写法类似：

```tsx
<PluginPreviewRenderer
  file={activeFile}
  showPluginDebug={process.env.NODE_ENV === "development"}
/>
```

如果当前没有传 `showPluginDebug`，需要补上。

如果当前写死为 `true`，需要改为：

```tsx
showPluginDebug={process.env.NODE_ENV === "development"}
```

预期效果：

```txt
开发环境：
显示 Plugin Renderer → <plugin.name> <plugin.id>

生产环境：
不显示 debug bar
```

示例：

```txt
Plugin Renderer → PDF Preview builtin.pdf
Plugin Renderer → Source Code Preview builtin.source-code
Plugin Renderer → DOCX Preview builtin.docx
Plugin Renderer → PPTX Preview builtin.pptx
Plugin Renderer → XLSX Preview builtin.xlsx
```

---

## 7. 新增验证矩阵文档

新增文件：

```txt
docs/preview-plugin-validation-matrix.md
```

完整内容如下：

````md
# FileVista Plugin Renderer Validation Matrix

## 1. 文档目的

本文档用于记录 FileVista Plugin Renderer 的文件类型支持状态、plugin 命中预期和手动回归验证流程。

14 阶段之后，新增或调整任何文件预览能力，都需要同步更新本文档。

---

## 2. 支持状态定义

| Status | 含义 |
|---|---|
| plugin-supported | 已迁移到 Plugin Renderer，应该正常命中 plugin |
| legacy-only | 仅 Legacy Renderer 支持，Plugin Renderer 暂未迁移 |
| degraded | 降级支持，不是完整预览能力 |
| unsupported | 明确不支持浏览器端预览 |

---

## 3. 验证矩阵

| FileType | 扩展名 | Legacy Renderer | Plugin Renderer | Plugin ID | 预期状态 | 备注 |
|---|---|---|---|---|---|---|
| pdf | .pdf | 支持 | 支持 | builtin.pdf | plugin-supported | 支持 source/content |
| code | .js/.ts/.tsx/.py/.go 等 | 支持 | 支持 | builtin.source-code | plugin-supported | Shiki 高亮 |
| json | .json | 支持 | 支持 | builtin.source-code | plugin-supported | JSON 当前复用 source-code plugin |
| text | .txt/.log/.env 等 | 支持 | 支持 | builtin.text | plugin-supported | 纯文本 |
| image | .png/.jpg/.webp 等 | 支持 | 支持 | builtin.image | plugin-supported | 依赖 object URL |
| audio | .mp3/.wav/.ogg 等 | 支持 | 支持 | builtin.audio | plugin-supported | 依赖 object URL |
| video | .mp4/.webm/.mov 等 | 支持 | 支持 | builtin.video | plugin-supported | 依赖 object URL |
| svg | .svg | 支持 | 支持 | builtin.svg | plugin-supported | 预览 + 源码 |
| csv | .csv | 支持 | 支持 | builtin.csv | plugin-supported | 表格预览 |
| markdown | .md/.mdx | 支持 | 支持 | builtin.markdown | plugin-supported | Markdown 渲染 |
| html | .html/.htm | 支持 | 支持 | builtin.html | plugin-supported | 安全预览 + 源码 |
| rtf | .rtf | 支持 | 支持 | builtin.rtf | plugin-supported | 文本提取预览 |
| zip | .zip | 支持 | 支持 | builtin.zip | plugin-supported | base64 content |
| epub | .epub | 支持 | 支持 | builtin.epub | plugin-supported | base64 content |
| docx | .docx | 支持 | 支持 | builtin.docx | plugin-supported | source/content 双通道 |
| pptx | .pptx | 支持 | 支持 | builtin.pptx | plugin-supported | source/content 双通道 |
| xlsx | .xlsx | 支持 | 支持 | builtin.xlsx | plugin-supported | source/content/fileSize |
| doc | .doc | 降级 | 不支持 | - | degraded | 不要混入 docx plugin |
| ppt | .ppt | 不支持 | 不支持 | - | unsupported | 不要混入 pptx plugin |
| xls | .xls | 不支持 | 不支持 | - | unsupported | 不要混入 xlsx plugin |
| unknown | 其它 | 不支持 | 不支持 | - | unsupported | 显示 Preview Not Available |

---

## 4. Plugin ID 命名规范

内置 plugin 统一使用：

```txt
builtin.<fileType>
````

示例：

```txt
builtin.pdf
builtin.text
builtin.image
builtin.rtf
builtin.zip
builtin.epub
builtin.docx
builtin.pptx
builtin.xlsx
```

特殊情况：

```txt
json 当前复用 builtin.source-code
```

原因：

```txt
JSON 预览本质上仍然是源码高亮和格式化展示。
当前阶段不单独拆 builtin.json，避免 14 阶段扩大改动范围。
```

---

## 5. Adapter 行为规范

Adapter 只负责三件事：

```txt
1. 检查必要输入
2. 桥接 FileInfo 到已有 Preview 组件 props
3. 在输入缺失时返回 UnsupportedPluginPreview
```

Adapter 禁止做以下事情：

```txt
不要重复解析文件
不要直接引入大型解析库
不要改写 file.content/source/url
不要把 .doc 混入 docx plugin
不要把 .ppt 混入 pptx plugin
不要把 .xls 混入 xlsx plugin
```

---

## 6. Adapter 输入规则

### 6.1 文本类

适用类型：

```txt
text
markdown
html
svg
csv
rtf
```

判断方式：

```tsx
if (!file.content) {
  return <UnsupportedPluginPreview fileType={file.fileType} />;
}
```

传参方式：

```tsx
return <SomePreview content={file.content} fileName={file.name} />;
```

---

### 6.2 URL 类

适用类型：

```txt
image
audio
video
```

判断方式：

```tsx
if (!file.url) {
  return <UnsupportedPluginPreview fileType={file.fileType} />;
}
```

传参方式：

```tsx
return <SomePreview url={file.url} fileName={file.name} />;
```

---

### 6.3 base64 二进制类

适用类型：

```txt
zip
epub
```

判断方式：

```tsx
if (!file.content) {
  return <UnsupportedPluginPreview fileType={file.fileType} />;
}
```

传参方式：

```tsx
return <SomePreview content={file.content} fileName={file.name} />;
```

注意：

```txt
14 阶段不要把 zip/epub 改成 source 模式。
```

---

### 6.4 Office 二进制类

适用类型：

```txt
docx
pptx
xlsx
```

判断方式：

```tsx
if (!file.source && !file.content) {
  return <UnsupportedPluginPreview fileType={file.fileType} />;
}
```

DOCX：

```tsx
<DocxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
/>
```

PPTX：

```tsx
<PptxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
/>
```

XLSX：

```tsx
<XlsxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
  fileSize={file.size}
/>
```

---

## 7. 手动回归验证流程

### 7.1 启动开发环境

```bash
bun install
bun run dev
```

访问：

```txt
http://localhost:3000
```

---

### 7.2 验证 Legacy Renderer

对以下类型逐个上传样例文件：

```txt
pdf
code
json
text
image
audio
video
svg
csv
markdown
html
rtf
zip
epub
docx
pptx
xlsx
doc
ppt
xls
unknown
```

检查：

```txt
Legacy Renderer 下，已有支持类型仍然正常
doc 仍然是降级支持
ppt/xls/unknown 显示不支持
```

---

### 7.3 验证 Plugin Renderer

切换到 Plugin Renderer，逐个检查以下预期：

```txt
PDF        → Plugin Renderer → PDF Preview builtin.pdf
Code       → Plugin Renderer → Source Code Preview builtin.source-code
JSON       → Plugin Renderer → Source Code Preview builtin.source-code
Text       → Plugin Renderer → Text Preview builtin.text
Image      → Plugin Renderer → Image Preview builtin.image
Audio      → Plugin Renderer → Audio Preview builtin.audio
Video      → Plugin Renderer → Video Preview builtin.video
SVG        → Plugin Renderer → SVG Preview builtin.svg
CSV        → Plugin Renderer → CSV Preview builtin.csv
Markdown   → Plugin Renderer → Markdown Preview builtin.markdown
HTML       → Plugin Renderer → HTML Preview builtin.html
RTF        → Plugin Renderer → RTF Preview builtin.rtf
ZIP        → Plugin Renderer → ZIP Preview builtin.zip
EPUB       → Plugin Renderer → EPUB Preview builtin.epub
DOCX       → Plugin Renderer → DOCX Preview builtin.docx
PPTX       → Plugin Renderer → PPTX Preview builtin.pptx
XLSX       → Plugin Renderer → XLSX Preview builtin.xlsx
```

---

### 7.4 验证不支持类型提示

以下类型在 Plugin Renderer 下不应显示 `Not Migrated Yet`：

```txt
doc
ppt
xls
unknown
```

预期结果：

```txt
doc      → Preview Not Available，并提示 legacy Word binary format / degraded
ppt      → Preview Not Available，并提示 convert to .pptx
xls      → Preview Not Available，并提示 convert to .xlsx
unknown  → Preview Not Available
```

---

### 7.5 验证生产环境 debug bar

构建并启动生产环境：

```bash
bun run build
bun run start
```

检查：

```txt
生产环境不显示 Plugin Renderer debug bar
```

开发环境：

```txt
应该显示 Plugin Renderer → <plugin.name> <plugin.id>
```

---

## 8. 验收标准

14 阶段完成后，需要满足以下条件：

```txt
1. 所有 plugin-supported 类型在 Plugin Renderer 下都能命中 plugin
2. 开发环境能看到 plugin name 和 plugin id
3. 生产环境不显示 debug bar
4. doc/ppt/xls/unknown 不再错误显示 Not Migrated Yet
5. doc/ppt/xls 不会被混入 docx/pptx/xlsx plugin
6. Adapter 仍然只做桥接，不做复杂解析
7. docs/preview-plugin-validation-matrix.md 已建立
8. README 中的支持类型说明与当前行为一致
```

---

## 9. 推荐提交信息

```bash
git add src/components/file-preview/support-status.ts
git add src/components/file-preview/PluginPreviewRenderer.tsx
git add src/app/page.tsx
git add docs/preview-plugin-validation-matrix.md

git commit -m "docs: add plugin renderer validation matrix"
git commit -m "fix: clarify plugin renderer unsupported states"
```

也可以合并为一个提交：

```bash
git add .
git commit -m "chore: close plugin renderer migration validation"
```

---

## 10. 阶段结论

14 阶段完成后，FileVista 的 Plugin Renderer 不只是“功能迁移完成”，而是进入了“可维护收口状态”。

本阶段完成后的核心判断规则是：

```txt
主流已迁移类型没命中 plugin = 问题
doc/ppt/xls/unknown 没命中 plugin = 正常，应显示 Preview Not Available
legacy-only 没命中 plugin = 才显示 Not Migrated Yet
```

后续新增文件类型时，需要同步维护：

```txt
1. FileType 类型定义
2. detectFileType
3. plugin 文件
4. builtinPreviewPlugins 注册
5. support-status.ts
6. docs/preview-plugin-validation-matrix.md
7. README 支持类型说明
```
