# FileVista 14 阶段 PRD：Plugin Renderer 收口治理与验证矩阵

## 1. 阶段定位

### 1.1 阶段名称

Plugin Renderer 收口治理与验证矩阵。

### 1.2 阶段背景

FileVista 当前已经完成主流预览类型从 Legacy Renderer 到 Plugin Renderer 的迁移。

已迁移类型包括：

```txt
PDF
Code
JSON
Text
Image
Audio
Video
SVG
CSV
Markdown
HTML
RTF
ZIP
EPUB
DOCX
PPTX
XLSX
```

经过前面阶段的迁移，当前 Plugin Renderer 已经覆盖 FileVista 的主要文件预览能力。接下来不应继续盲目新增渲染器，而应进入收口治理阶段，重点解决以下问题：

```txt
哪些类型应该命中 plugin？
哪些类型仍然走 legacy？
哪些类型应该明确不支持？
debug bar 是否准确？
Not Migrated Yet 是否还会误出现？
Preview Not Available 是否只在真正不支持时出现？
legacy/plugin 行为是否一致？
```

14 阶段的核心目标是让 Plugin Renderer 的迁移结果变得可验证、可回归、可维护。

---

## 2. 阶段目标

### 2.1 核心目标

14 阶段的核心目标是建立一套清晰的 Plugin Renderer 收口体系，包括：

```txt
1. 文件类型支持状态矩阵
2. legacy/plugin 对照验证清单
3. plugin 命中验证标准
4. 未支持类型提示标准
5. Adapter 行为一致性规范
6. 手动回归测试流程
7. 后续阶段进入稳定优化的准入条件
```

### 2.2 业务目标

从使用体验上，用户应能明确知道：

```txt
当前文件是否支持预览
当前文件是否已迁移到 Plugin Renderer
当前文件命中了哪个 plugin
当前不能预览是因为暂未迁移，还是确实不支持
```

### 2.3 技术目标

从工程维护上，开发者应能快速判断：

```txt
新增一个文件类型需要改哪些地方
一个文件类型是否已经迁移完成
一个 plugin 是否注册成功
一个 Adapter 是否正确处理了 content/source/url
一个预览失败问题属于 plugin 命中问题还是组件内部渲染问题
```

---

## 3. 非目标

14 阶段不做以下事情：

```txt
不新增新的文件预览类型
不重构 DOCX / PPTX / XLSX 内部解析逻辑
不重写 Plugin Registry
不移除 Legacy Renderer
不处理旧版 Office 二进制格式的完整预览
不做服务端解析
不引入新的大型依赖
不做性能深度优化
```

14 阶段只做收口、验证、规范和少量必要的治理代码。

---

## 4. 当前支持状态定义

14 阶段需要统一 FileVista 内部对文件类型状态的定义。

### 4.1 状态枚举

建议将文件类型状态分为四类：

```ts
type PreviewSupportStatus =
  | "plugin-supported"
  | "legacy-only"
  | "degraded"
  | "unsupported";
```

### 4.2 状态说明

#### plugin-supported

表示该类型已经完成 Plugin Renderer 迁移，并且 Plugin Renderer 应该可以正常命中对应 plugin。

示例：

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
```

#### legacy-only

表示该类型目前仍只在 Legacy Renderer 中有处理，但不进入 Plugin Renderer。

当前阶段理论上不应再有核心类型属于 legacy-only。后续如果新增临时类型，可以使用该状态。

#### degraded

表示该类型不是完整预览，只提供降级能力或提示。

示例：

```txt
doc
```

`.doc` 是旧版 Word 二进制格式。当前可以继续保持文本提取或降级提示，不应和 `.docx` 混为一个 plugin。

#### unsupported

表示该类型当前明确不支持浏览器端预览。

示例：

```txt
ppt
xls
unknown
```

`.ppt` 和 `.xls` 是旧版 Office 二进制格式，不能简单复用 `.pptx` / `.xlsx` 的渲染器。

---

## 5. 文件类型验证矩阵

14 阶段需要建立一份明确的验证矩阵。

建议新增文档：

```txt
docs/preview-plugin-validation-matrix.md
```

内容结构如下：

| FileType | 扩展名                    | Legacy Renderer | Plugin Renderer | Plugin ID                          | 预期状态             | 备注                       |
| -------- | ---------------------- | --------------- | --------------- | ---------------------------------- | ---------------- | ------------------------ |
| pdf      | .pdf                   | 支持              | 支持              | builtin.pdf                        | plugin-supported | 支持 source/content        |
| code     | .js/.ts/.tsx/.py/.go 等 | 支持              | 支持              | builtin.source-code                | plugin-supported | Shiki 高亮                 |
| json     | .json                  | 支持              | 支持              | builtin.source-code 或 builtin.json | plugin-supported | 如复用 code plugin，需明确记录    |
| text     | .txt/.log/.env 等       | 支持              | 支持              | builtin.text                       | plugin-supported | 纯文本                      |
| image    | .png/.jpg/.webp 等      | 支持              | 支持              | builtin.image                      | plugin-supported | 依赖 object URL            |
| audio    | .mp3/.wav/.ogg 等       | 支持              | 支持              | builtin.audio                      | plugin-supported | 依赖 object URL            |
| video    | .mp4/.webm/.mov 等      | 支持              | 支持              | builtin.video                      | plugin-supported | 依赖 object URL            |
| svg      | .svg                   | 支持              | 支持              | builtin.svg                        | plugin-supported | 预览 + 源码                  |
| csv      | .csv                   | 支持              | 支持              | builtin.csv                        | plugin-supported | 表格预览                     |
| markdown | .md/.mdx               | 支持              | 支持              | builtin.markdown                   | plugin-supported | Markdown 渲染              |
| html     | .html/.htm             | 支持              | 支持              | builtin.html                       | plugin-supported | 安全预览 + 源码                |
| rtf      | .rtf                   | 支持              | 支持              | builtin.rtf                        | plugin-supported | 文本提取预览                   |
| zip      | .zip                   | 支持              | 支持              | builtin.zip                        | plugin-supported | 文件树                      |
| epub     | .epub                  | 支持              | 支持              | builtin.epub                       | plugin-supported | 章节/目录/图片                 |
| docx     | .docx                  | 支持              | 支持              | builtin.docx                       | plugin-supported | source/content 双通道       |
| pptx     | .pptx                  | 支持              | 支持              | builtin.pptx                       | plugin-supported | source/content 双通道       |
| xlsx     | .xlsx                  | 支持              | 支持              | builtin.xlsx                       | plugin-supported | source/content/fileSize  |
| doc      | .doc                   | 降级              | 不进入 plugin      | 无                                  | degraded         | 不要混入 docx                |
| ppt      | .ppt                   | 不支持/提示          | 不进入 plugin      | 无                                  | unsupported      | 不要混入 pptx                |
| xls      | .xls                   | 不支持/提示          | 不进入 plugin      | 无                                  | unsupported      | 不要混入 xlsx                |
| unknown  | 其它                     | 不支持             | 不支持             | 无                                  | unsupported      | 显示 Preview Not Available |

---

## 6. Plugin ID 命名规范

14 阶段需要确认所有内置 plugin 的 id 命名一致。

### 6.1 命名规则

```txt
builtin.<fileType>
```

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

### 6.2 特殊情况

如果 JSON 复用 Code Preview，需要明确选择其中一种策略：

#### 方案 A：JSON 复用 source-code plugin

```txt
id: builtin.source-code
match: code 或 json
```

优点：

```txt
组件复用
实现简单
```

缺点：

```txt
debug bar 中 JSON 显示 source-code，不够直观
```

#### 方案 B：JSON 单独 jsonPlugin

```txt
id: builtin.json
match: json
load: JsonPreviewAdapter 或 CodePreviewAdapter
```

优点：

```txt
debug bar 更清晰
验证矩阵更直观
```

缺点：

```txt
多一个 plugin 文件
```

14 阶段建议至少在验证矩阵中明确当前采用哪种策略，避免后续误判。

---

## 7. Adapter 行为规范

14 阶段需要统一 Adapter 的写法和判断逻辑。

### 7.1 文本类 Adapter

适用于：

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

### 7.2 URL 类 Adapter

适用于：

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

### 7.3 二进制 base64 类 Adapter

适用于：

```txt
zip
epub
```

当前这两个 legacy 组件主要依赖 base64 `content`。

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
不要在 14 阶段把 zip/epub 改成 source 模式
不要在 14 阶段重构 zip/epub 内部解析
```

### 7.4 Office 二进制 Adapter

适用于：

```txt
docx
pptx
xlsx
```

这类组件已经支持 `source + content` 双通道。

判断方式：

```tsx
if (!file.source && !file.content) {
  return <UnsupportedPluginPreview fileType={file.fileType} />;
}
```

DOCX 传参：

```tsx
<DocxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
/>
```

PPTX 传参：

```tsx
<PptxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
/>
```

XLSX 传参：

```tsx
<XlsxPreview
  content={file.content}
  source={file.source}
  fileName={file.name}
  fileSize={file.size}
/>
```

### 7.5 禁止行为

Adapter 中禁止做以下事情：

```txt
不要重复解析文件
不要在 Adapter 中做复杂业务逻辑
不要在 Adapter 中直接 import 大型解析库
不要在 Adapter 中改变原始 file.content/source/url
不要把旧版 doc/ppt/xls 混入 docx/pptx/xlsx plugin
```

Adapter 只负责：

```txt
检查必要输入
桥接 FileInfo 到 legacy preview props
返回 UnsupportedPluginPreview
```

---

## 8. Debug Bar 规范

### 8.1 开发环境

开发环境中，Plugin Renderer 命中 plugin 后应显示 debug bar。

格式建议：

```txt
Plugin Renderer → <plugin.name> <plugin.id>
```

示例：

```txt
Plugin Renderer → PDF Preview builtin.pdf
Plugin Renderer → DOCX Preview builtin.docx
Plugin Renderer → XLSX Preview builtin.xlsx
```

### 8.2 生产环境

生产环境不显示 debug bar。

### 8.3 未命中 plugin

如果当前文件类型没有对应 plugin，应显示：

```txt
Not Migrated Yet
```

但在 14 阶段完成后，主流类型不应再出现该提示。

理论上只有以下情况可能出现：

```txt
legacy-only 类型
未来新增但未迁移类型
```

### 8.4 真正不支持

真正不支持预览时，应显示：

```txt
Preview Not Available
```

适用场景：

```txt
unknown
明确不支持的二进制格式
文件缺少必要输入
```

---

## 9. Legacy / Plugin 对照验证流程

14 阶段需要建立标准手动验证流程。

### 9.1 验证入口

页面应保留两个切换入口：

```txt
Legacy Renderer
Plugin Renderer
```

验证人员需要对每种文件类型执行以下步骤：

```txt
1. 上传对应测试文件
2. 先切 Legacy Renderer
3. 记录 legacy 是否正常
4. 再切 Plugin Renderer
5. 检查是否命中预期 plugin
6. 检查 UI 是否和 legacy 基本一致
7. 检查控制台是否有异常
8. 检查切换其它文件后状态是否保留或重置合理
```

### 9.2 通用验收标准

每种已迁移类型必须满足：

```txt
Plugin Renderer 不显示 Not Migrated Yet
Plugin Renderer 不错误显示 Preview Not Available
debug bar plugin id 正确
基本预览内容正常
切换文件不崩溃
清空文件不报错
重新上传同类型文件可正常渲染
```

### 9.3 Office 类型额外标准

DOCX：

```txt
文件能渲染
页数能显示
图片尽量正常
表格尽量正常
滚动正常
切换文件后旧 DOM 被清理
```

PPTX：

```txt
幻灯片能渲染
上一页/下一页正常
grid/slide 模式正常
缩放正常
全屏按钮不报错
EMF/WMF 图片不会导致明显 broken image 干扰
```

XLSX：

```txt
sheet 切换正常
表格内容正常
搜索正常
缩放正常
fast/fidelity 模式正常
大文件提示合理
图片/批注/超链接表现与 legacy 一致
```

---

## 10. 测试样例文件要求

14 阶段需要准备一组固定测试文件。

建议放在：

```txt
public/demo-files/
```

或者建立说明文档：

```txt
docs/manual-test-files.md
```

### 10.1 基础文件

```txt
sample.pdf
sample.md
sample.json
sample.ts
sample.txt
sample.csv
sample.html
sample.svg
sample.png
sample.mp3
sample.mp4
```

### 10.2 中等复杂度文件

```txt
sample.rtf
sample.zip
sample.epub
```

### 10.3 Office 文件

```txt
sample.docx
sample.pptx
sample.xlsx
```

### 10.4 不支持/降级文件

```txt
sample.doc
sample.ppt
sample.xls
sample.unknown
```

### 10.5 XLSX 建议样例

至少准备三类 XLSX：

```txt
small.xlsx：少量单元格，快速验证基本展示
styled.xlsx：包含合并单元格、样式、颜色、边框
large.xlsx：较多行列，用于验证性能模式和限制提示
```

### 10.6 PPTX 建议样例

至少准备两类 PPTX：

```txt
basic.pptx：纯文本和简单图形
media.pptx：包含图片、复杂布局、可能存在 EMF/WMF 的文件
```

### 10.7 DOCX 建议样例

至少准备三类 DOCX：

```txt
basic.docx：纯文本
table.docx：包含表格
media.docx：包含图片、页眉页脚、分页
```

---

## 11. 验收矩阵

14 阶段最终验收需要完成以下矩阵。

| 类型       | Legacy 正常 | Plugin 正常   | Debug ID 正确         | 无控制台严重错误 | 结论  |
| -------- | --------- | ----------- | ------------------- | -------- | --- |
| PDF      | 待测        | 待测          | builtin.pdf         | 待测       | 待定  |
| Code     | 待测        | 待测          | builtin.source-code | 待测       | 待定  |
| JSON     | 待测        | 待测          | 待确认                 | 待测       | 待定  |
| Text     | 待测        | 待测          | builtin.text        | 待测       | 待定  |
| Image    | 待测        | 待测          | builtin.image       | 待测       | 待定  |
| Audio    | 待测        | 待测          | builtin.audio       | 待测       | 待定  |
| Video    | 待测        | 待测          | builtin.video       | 待测       | 待定  |
| SVG      | 待测        | 待测          | builtin.svg         | 待测       | 待定  |
| CSV      | 待测        | 待测          | builtin.csv         | 待测       | 待定  |
| Markdown | 待测        | 待测          | builtin.markdown    | 待测       | 待定  |
| HTML     | 待测        | 待测          | builtin.html        | 待测       | 待定  |
| RTF      | 待测        | 待测          | builtin.rtf         | 待测       | 待定  |
| ZIP      | 待测        | 待测          | builtin.zip         | 待测       | 待定  |
| EPUB     | 待测        | 待测          | builtin.epub        | 待测       | 待定  |
| DOCX     | 待测        | 待测          | builtin.docx        | 待测       | 待定  |
| PPTX     | 待测        | 待测          | builtin.pptx        | 待测       | 待定  |
| XLSX     | 待测        | 待测          | builtin.xlsx        | 待测       | 待定  |
| DOC      | 待测        | 不应命中 plugin | 无                   | 待测       | 降级  |
| PPT      | 待测        | 不应命中 plugin | 无                   | 待测       | 不支持 |
| XLS      | 待测        | 不应命中 plugin | 无                   | 待测       | 不支持 |
| Unknown  | 不支持       | 不支持         | 无                   | 待测       | 不支持 |

---

## 12. 建议新增文档

14 阶段建议新增以下文档：

```txt
docs/preview-plugin-validation-matrix.md
docs/plugin-renderer-adapter-guidelines.md
docs/manual-preview-regression-checklist.md
```

### 12.1 preview-plugin-validation-matrix.md

用于记录所有文件类型的支持状态、plugin id、验证结果。

### 12.2 plugin-renderer-adapter-guidelines.md

用于记录 Adapter 写法规范，包括：

```txt
文本类 Adapter
URL 类 Adapter
base64 二进制类 Adapter
source/content Office Adapter
不支持类型处理
```

### 12.3 manual-preview-regression-checklist.md

用于每次大改后手动回归。

---

## 13. 建议新增轻量代码治理

14 阶段可以做少量轻量代码治理，但不做重构。

### 13.1 可选：建立 plugin manifest

可以新增一个纯说明型常量文件：

```txt
src/components/file-preview/plugins/plugin-manifest.ts
```

示例：

```ts
export const PLUGIN_PREVIEW_MANIFEST = [
  {
    fileType: "pdf",
    pluginId: "builtin.pdf",
    status: "plugin-supported",
  },
  {
    fileType: "docx",
    pluginId: "builtin.docx",
    status: "plugin-supported",
  },
  {
    fileType: "ppt",
    pluginId: null,
    status: "unsupported",
  },
] as const;
```

用途：

```txt
给测试/文档/开发调试使用
不参与实际 plugin resolve
不影响运行时逻辑
```

### 13.2 可选：统一 unsupported copy

目前存在几个类似概念：

```txt
Not Migrated Yet
Preview Not Available
旧版 Office 暂不支持
```

14 阶段可以统一文案标准。

#### Not Migrated Yet

用于：

```txt
该类型理论上未来会迁移，但当前没有 plugin
```

#### Preview Not Available

用于：

```txt
该类型无法在浏览器中预览
```

#### Legacy Office Unsupported

用于：

```txt
.doc / .ppt / .xls 旧版 Office 二进制格式
```

建议文案：

```txt
旧版 Office 二进制格式暂不支持完整浏览器端预览。
建议使用 Office / WPS / LibreOffice 转换为对应的 Open XML 格式后重试。
```

---

## 14. 回归测试流程

### 14.1 基础流程

每次完成 14 阶段改动后，执行：

```bash
bun install
bun run lint
bun run dev
```

然后打开：

```txt
http://localhost:3000
```

### 14.2 手动测试顺序

建议按复杂度从低到高测试：

```txt
1. text
2. markdown
3. json
4. code
5. image
6. audio
7. video
8. svg
9. csv
10. html
11. pdf
12. rtf
13. zip
14. epub
15. docx
16. pptx
17. xlsx
18. doc
19. ppt
20. xls
21. unknown
```

### 14.3 每个文件的检查点

```txt
文件能添加到列表
文件类型 badge 正确
Legacy Renderer 行为正常
Plugin Renderer 行为正常
debug bar 显示正确 plugin id
切换文件后不崩溃
删除当前文件后不崩溃
Clear All 后不残留错误状态
浏览器控制台没有严重错误
```

### 14.4 Office 文件额外检查点

```txt
多次切换 legacy/plugin 不重复渲染异常
多次切换不同 Office 文件不残留旧 DOM
大文件加载时有 loading
解析失败时错误提示可理解
```

---

## 15. 验收标准

14 阶段完成必须满足以下条件。

### 15.1 功能验收

```txt
所有已迁移类型在 Plugin Renderer 中都能命中预期 plugin
所有已迁移类型不再显示 Not Migrated Yet
所有已迁移类型不错误显示 Preview Not Available
DOC / PPT / XLS 不被错误纳入 DOCX / PPTX / XLSX plugin
unknown 类型显示明确不支持
```

### 15.2 调试验收

```txt
开发环境显示 debug bar
debug bar 展示 plugin name
debug bar 展示 plugin id
生产环境不显示 debug bar
```

### 15.3 文档验收

```txt
有完整验证矩阵
有 Adapter 规范说明
有手动回归测试清单
```

### 15.4 稳定性验收

```txt
bun run lint 通过
上传/切换/删除/清空文件不崩溃
多文件切换不出现明显状态串扰
Office 文件渲染失败时有可理解错误提示
```

---

## 16. 风险点

### 16.1 JSON plugin id 可能不够直观

如果 JSON 当前复用 Code Plugin，debug bar 可能显示 source-code，而不是 json。

解决策略：

```txt
短期：在验证矩阵中注明 JSON 复用 source-code
长期：可拆出 jsonPlugin，但复用 CodePreviewAdapter
```

### 16.2 Office 文件兼容性问题容易被误判为 plugin 问题

DOCX / PPTX / XLSX 的失败可能来自底层解析库，而不是 plugin 未命中。

判断方式：

```txt
如果 debug bar 正确显示 builtin.docx / builtin.pptx / builtin.xlsx
说明 plugin 命中没有问题
后续失败属于预览组件内部解析问题
```

### 16.3 ZIP / EPUB 仍依赖 legacy base64 content

当前 ZIP / EPUB Adapter 仍然只传 `content`。

这是阶段性合理策略，但未来如果要支持纯 URL/source 输入，需要单独升级 ZIP / EPUB 内部读取方式。

### 16.4 大 XLSX 仍可能造成浏览器压力

即使有 fileSize，XLSX 仍然可能因为行列、图片、样式复杂导致性能问题。

14 阶段只要求行为和 legacy 一致，不要求彻底优化。

---

## 17. 推荐任务拆分

### Task 14.1：新增验证矩阵文档

产出：

```txt
docs/preview-plugin-validation-matrix.md
```

内容包括：

```txt
FileType
扩展名
Legacy 支持状态
Plugin 支持状态
Plugin ID
预期结果
验证状态
备注
```

### Task 14.2：新增 Adapter 规范文档

产出：

```txt
docs/plugin-renderer-adapter-guidelines.md
```

内容包括：

```txt
文本类 Adapter
URL 类 Adapter
base64 二进制 Adapter
Office source/content Adapter
不支持类型策略
```

### Task 14.3：新增手动回归清单

产出：

```txt
docs/manual-preview-regression-checklist.md
```

内容包括：

```txt
测试文件准备
测试顺序
每类文件检查项
Office 额外检查项
通过/失败记录方式
```

### Task 14.4：检查 builtin plugin 注册顺序

检查文件：

```txt
src/components/file-preview/plugins/builtin-plugins.ts
```

确认当前顺序清晰：

```txt
基础类型
媒体类型
结构化文本
中等复杂类型
Office 类型
```

建议顺序：

```txt
pdf
sourceCode
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
```

### Task 14.5：人工执行完整回归

执行：

```bash
bun run lint
bun run dev
```

完成验证矩阵中的所有类型测试。

---

## 18. 交付物

14 阶段最终交付物：

```txt
1. docs/preview-plugin-validation-matrix.md
2. docs/plugin-renderer-adapter-guidelines.md
3. docs/manual-preview-regression-checklist.md
4. 完整手动验证结果
5. 如有必要，少量文案或注册顺序调整
```

不要求交付：

```txt
新渲染器
新解析库
自动化测试框架
Office 内部优化
性能重构
```

---

## 19. 完成后的下一阶段建议

14 阶段完成后，可以进入 15 阶段。

建议 15 阶段方向：

```txt
Plugin Renderer 稳定性优化与 source 化改造
```

可能包含：

```txt
1. ZIP / EPUB 支持 source 读取
2. 统一 binary preview input
3. Office 大文件性能优化
4. Plugin manifest 与验证矩阵联动
5. 自动化 smoke test
6. Legacy Renderer 逐步降级为对照工具
```

---

## 20. 总结

14 阶段不是继续迁移文件类型，而是为已经完成的 Plugin Renderer 迁移做工程收口。

本阶段完成后，FileVista 应具备：

```txt
清晰的文件类型支持边界
稳定的 plugin 命中判断
可复用的 Adapter 编写规范
可执行的手动回归流程
可持续维护的验证矩阵
```

这会为后续继续做 source 化、性能优化、自动化测试和 Legacy Renderer 退场打好基础。
