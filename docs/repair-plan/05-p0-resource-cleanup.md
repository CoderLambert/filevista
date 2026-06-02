# P0 - 预览资源释放修复

## 背景

文件预览会产生大量浏览器资源：

- Object URL
- PDF document
- PDF render task
- PPTX viewer 实例
- docx-preview DOM
- iframe Blob URL
- SVG Blob URL
- audio / video object URL

如果不清理，多文件切换和 TabCache 会导致内存上涨。

## 涉及文件

```txt
src/app/page.tsx
src/components/file-preview/PdfPreview.tsx
src/components/file-preview/PptxPreview.tsx
src/components/file-preview/DocxPreview.tsx
src/components/file-preview/HtmlPreview.tsx
src/components/file-preview/SvgPreview.tsx
src/components/file-preview/ImagePreview.tsx
src/components/file-preview/VideoPreview.tsx
src/components/file-preview/AudioPreview.tsx
```

## 任务 1：统一 object URL 管理

当前 `page.tsx` 中删除文件和清空文件时需要确保：

```ts
if (file.url) {
  URL.revokeObjectURL(file.url);
}
```

建议封装：

```ts
function revokeFileResources(file: FileInfo) {
  if (file.url) {
    URL.revokeObjectURL(file.url);
  }
}
```

删除文件：

```ts
setFiles((prev) => {
  const file = prev.find((f) => f.id === id);
  if (file) revokeFileResources(file);
  return prev.filter((f) => f.id !== id);
});
```

清空文件：

```ts
files.forEach(revokeFileResources);
setFiles([]);
setActiveFileId(null);
```

## 任务 2：PDF cleanup

参考 `03-p0-pdf-worker-and-cleanup.md`。

## 任务 3：PPTX cleanup

确保组件卸载时：

```ts
if (viewerRef.current) {
  try {
    viewerRef.current.destroy?.();
  } catch {
    // ignore
  }

  viewerRef.current = null;
}
```

同时清空容器：

```ts
if (containerRef.current) {
  containerRef.current.innerHTML = "";
}
```

## 任务 4：DOCX cleanup

在 cleanup 中清理容器：

```ts
return () => {
  mountedRef.current = false;

  if (containerRef.current) {
    containerRef.current.innerHTML = "";
  }
};
```

## 任务 5：HTML / SVG Blob URL cleanup

HTML 和 SVG 已有 `URL.revokeObjectURL` 思路，需要确保依赖正确：

```ts
useEffect(() => {
  return () => URL.revokeObjectURL(blobUrl);
}, [blobUrl]);
```

## 任务 6：TabCache 内存上限

当前 TabCache 会保留所有文件预览状态。建议增加最大缓存数量：

```ts
const MAX_CACHED_TABS = 8;
```

后续可以实现 LRU：

```txt
最近打开的 8 个文件保持 mounted
更早的文件卸载释放资源
```

## 验收标准

* 连续打开多个 PDF 后清空，内存不持续上涨
* 连续打开多个 PPTX 后清空，内存不持续上涨
* 删除图片 / 视频 / 音频文件后 object URL 被释放
* HTML / SVG 切换后 Blob URL 被释放
