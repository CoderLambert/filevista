# P2 - 预览插件化架构

## 背景

当前 `FilePreviewContent` 通过 `switch(file.fileType)` 选择预览器。短期清晰，但长期不利于扩展、拆包和多框架适配。

## 目标

引入：

```txt
PreviewPlugin
PluginRegistry
PluginPreviewRenderer
```

## 涉及文件

```txt
src/components/file-preview/core/plugin.ts
src/components/file-preview/core/registry.ts
src/components/file-preview/FilePreviewRenderer.tsx
src/components/file-preview/plugins/*
```

## 任务 1：定义 PreviewPlugin

```ts
export interface PreviewComponentProps {
  file: NormalizedFile;
}

export interface PreviewPlugin {
  id: string;
  name: string;
  priority?: number;

  match(file: NormalizedFile): boolean;

  load(): Promise<{
    default: React.ComponentType<PreviewComponentProps>;
  }>;
}
```

## 任务 2：定义插件注册表

```ts
export class PreviewPluginRegistry {
  private plugins: PreviewPlugin[] = [];

  register(plugin: PreviewPlugin) {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  resolve(file: NormalizedFile): PreviewPlugin | null {
    return this.plugins.find((plugin) => plugin.match(file)) || null;
  }

  list() {
    return [...this.plugins];
  }
}
```

## 任务 3：PDF 插件示例

```ts
export const pdfPlugin: PreviewPlugin = {
  id: "pdf",
  name: "PDF Preview",
  match(file) {
    return file.fileType === "pdf";
  },
  load() {
    return import("../PdfPreview").then((m) => ({
      default: m.PdfPreviewAdapter,
    }));
  },
};
```

## 任务 4：增加适配层

因为当前 `PdfPreview` 接收的是：

```ts
content: string;
fileName: string;
```

而插件组件未来接收：

```ts
file: NormalizedFile;
```

所以新增 adapter：

```tsx
export function PdfPreviewAdapter({ file }: PreviewComponentProps) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    // 临时兼容旧 base64 逻辑
  }, [file]);

  if (!content) return <PreviewLoading />;

  return <PdfPreview content={content} fileName={file.name} />;
}
```

## 任务 5：PluginPreviewRenderer

```tsx
export function PluginPreviewRenderer({
  file,
  registry,
}: {
  file: NormalizedFile;
  registry: PreviewPluginRegistry;
}) {
  const plugin = registry.resolve(file);

  if (!plugin) {
    return <UnsupportedPreview fileType={file.fileType} />;
  }

  const Preview = lazy(plugin.load);

  return (
    <Suspense fallback={<PreviewLoading />}>
      <Preview file={file} />
    </Suspense>
  );
}
```

## 任务 6：迁移策略

不要一次性替换所有 switch。

建议顺序：

```txt
1. 先保留 FilePreviewRenderer switch
2. 新增 PluginPreviewRenderer
3. 先迁移 image / text / code / pdf
4. 再迁移 docx / xlsx / pptx
5. 最后删除 switch
```

## 验收标准

* 可以通过 registry 注册插件
* PDF 插件可以正常渲染
* Code 插件可以正常渲染
* 未匹配插件时显示 Unsupported
* 旧 FilePreviewRenderer 仍可使用
