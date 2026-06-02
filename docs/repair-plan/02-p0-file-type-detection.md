# P0 - 文件类型识别修复

## 背景

当前文件类型识别已经覆盖很多格式，但有几个准确性问题：

1. `.ppt` 和 `.pptx` 不应共用 `pptx`
2. `.xls` 和 `.xlsx` 不应共用 `xlsx`
3. `Dockerfile` / `Makefile` 这类无扩展名文件可能识别失败

## 涉及文件

```txt
src/components/file-preview/utils.ts
src/components/file-preview/FilePreviewRenderer.tsx
src/components/file-preview/registry/builtin-preview-plugins.tsx
```

## 任务 1：扩展 FileType

修改：

```ts
export type FileType =
  | "pdf"
  | "markdown"
  | "json"
  | "code"
  | "docx"
  | "doc"
  | "pptx"
  | "ppt"
  | "xlsx"
  | "xls"
  | "html"
  | "zip"
  | "svg"
  | "rtf"
  | "epub"
  | "image"
  | "text"
  | "csv"
  | "video"
  | "audio"
  | "unknown";
```

## 任务 2：修复 PPT / PPTX 识别

```ts
if (
  ext === "pptx" ||
  mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
) {
  return "pptx";
}

if (
  ext === "ppt" ||
  mimeType === "application/vnd.ms-powerpoint"
) {
  return "ppt";
}
```

## 任务 3：修复 XLS / XLSX 识别

```ts
if (
  ext === "xlsx" ||
  mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
) {
  return "xlsx";
}

if (
  ext === "xls" ||
  mimeType === "application/vnd.ms-excel"
) {
  return "xls";
}
```

## 任务 4：修复无扩展名代码文件识别

当前应统一使用小写判断：

```ts
const baseName = filename.toLowerCase().split("/").pop() || "";

if (
  [
    "dockerfile",
    "makefile",
    "gnumakefile",
    "gemfile",
    "rakefile",
    "vagrantfile",
    ".gitignore",
    ".env",
    ".eslintrc",
    ".prettierrc",
  ].includes(baseName)
) {
  return "code";
}
```

## 任务 5：增加 legacy office 兜底组件

新增：

```txt
src/components/file-preview/UnsupportedLegacyOfficePreview.tsx
```

示例：

```tsx
interface UnsupportedLegacyOfficePreviewProps {
  type: "ppt" | "xls";
  title: string;
  description: string;
}

export function UnsupportedLegacyOfficePreview({
  title,
  description,
}: UnsupportedLegacyOfficePreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3 px-6">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-center max-w-md">{description}</p>
    </div>
  );
}
```

## 任务 6：Renderer 增加分支

在 `FilePreviewRenderer.tsx` 中增加：

```tsx
case "ppt":
  return (
    <UnsupportedLegacyOfficePreview
      type="ppt"
      title="旧版 PowerPoint 格式暂不支持"
      description="该文件为旧版 .ppt 二进制格式，当前浏览器端预览仅支持 .pptx。建议使用 PowerPoint 或 WPS 将文件另存为 .pptx 后重试。"
    />
  );

case "xls":
  return (
    <UnsupportedLegacyOfficePreview
      type="xls"
      title="旧版 Excel 格式暂不支持"
      description="该文件为旧版 .xls 二进制格式，当前浏览器端预览仅支持 .xlsx。建议使用 Excel 或 WPS 将文件另存为 .xlsx 后重试。"
    />
  );
```

## 验收标准

| 文件         | 预期                           |
| ---------- | ---------------------------- |
| demo.pptx  | fileType = pptx              |
| legacy.ppt | fileType = ppt，并显示不支持提示      |
| demo.xlsx  | fileType = xlsx              |
| legacy.xls | fileType = xls，并显示不支持提示      |
| Dockerfile | fileType = code              |
| Makefile   | fileType = code              |
| .env       | fileType = code 或 text，需行为一致 |
