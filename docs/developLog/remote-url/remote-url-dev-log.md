# Remote URL 模块 — 开发日志

## 概述

`src/components/file-preview/remote-url.ts` 实现远程 URL 文件预览能力，包括 URL 解析、HTTP fetch、文件名解析、MIME 识别（扩展名/Header/Magic/容器识别）和文件加载。

## 完整提交历史

| Commit | 说明 |
|---|---|
| `bba97f6` | feat: support remote file URL preview（初始实现） |
| `0d5a926` | fix: improve remote URL error handling and CORS fallback |
| `56527b3` | fix: remove console.warn from remote URL error handling |
| `d743a25` | fix: mount sonner Toaster to render toast messages |
| `3eede63` | feat: auto-load default PPTX URL on first visit |
| `0142fb1` | feat: add docs（remote-url 相关 PRD 文档） |
| `d7eb34b` | fix: strengthen magic priority and RFC5987 filename parsing |

## 模块架构

### 核心函数

| 函数 | 行号（约） | 职责 |
|---|---|---|
| `processRemoteUrl` | 513 | 入口：URL 校验 → fetch → 解析 → 返回 FileInfo |
| `getRemoteFileName` | 200 | 文件名解析：Content-Disposition > query params > pathname |
| `getFileNameFromContentDisposition` | 171 | Content-Disposition 头解析（含 RFC5987） |
| `sniffMagic` | 299 | 文件头 magic 字节识别（PDF/ZIP/PNG/JPG/GIF/WEBP/MP4/OLE） |
| `sniffZipContainer` | 378 | ZIP 容器识别（docx/pptx/xlsx/epub） |
| `resolveRemoteMimeType` | 434 | MIME 类型决策：综合扩展名/Header/Magic/容器结果 |
| `REMOTE_MIME_BY_EXTENSION` | 54 | 扩展名 → MIME 映射表 |

### 决策流

```
URL 校验 → HTTP fetch → 获取响应
  ↓
提取 Content-Disposition Header
  ↓
解析文件名（Content-Disposition → query → pathname → fallback）
  ↓
读取响应为 ArrayBuffer
  ↓
sniffMagic 识别文件头（32 字节）
  ↓
如果是 ZIP 容器 → sniffZipContainer 识别具体类型
  ↓
resolveRemoteMimeType 综合决策最终 MIME
  ↓
detectFileType 映射到 FileType
  ↓
按类型编码（base64 / object URL / text）
  ↓
返回 FileInfo
```

## 关键决策：Magic 优先级修正

### 问题（`d7eb34b` 修复前）

原来的优先级：
```
容器识别
→ 强 magic（排除 application/zip）
→ 扩展名
→ Content-Type header
→ magic（兜底）
→ fallback
```

问题场景：

**场景 A：`.ppt` 被 OLE magic 覆盖**
```txt
URL: xxx.ppt
magic: application/x-ole-storage  （所有 .doc/.ppt/.xls 共享 OLE 特征码）
结果: MIME 被覆盖为 x-ole-storage，不够准确
```

**场景 B：`.m4a` 被 ftyp magic 覆盖**
```txt
URL: xxx.m4a
magic: video/mp4  （ftyp 是 MP4 容器特征，m4a/mp4 共用）
结果: detectFileType 可能将 .m4a 误判为 video
```

### 修复方案

引入"强 magic"和"弱 magic"概念：

```ts
const WEAK_MAGIC_MIME_TYPES = new Set([
  "application/zip",
  "application/x-ole-storage",
  "video/mp4",
]);
```

新优先级：
```
容器识别（docx/pptx/xlsx/epub）
→ 强 magic（PDF/PNG/JPG/GIF/WEBP）
→ 扩展名（.ppt/.m4a/.xls 等）
→ Content-Type header
→ 弱 magic（zip/ole/ftyp）
→ fallback
```

效果：
- `.ppt` URL + OLE magic → 扩展名优先，MIME 保持 `application/vnd.ms-powerpoint`
- `.m4a` URL + ftyp magic → 扩展名优先，MIME 保持 `audio/mp4`
- PDF/PNG/JPG 等强特征文件不受影响

## 关键决策：RFC5987 filename 解析

### 问题

原来只支持 `UTF-8''filename` 格式，但标准中也允许 `UTF-8'en'filename`（带语言标记）。

### 修复

原来：
```ts
const utf8PrefixMatch = rawValue.match(/^UTF-8''(.+)$/i);
```

改为：
```ts
const rfc5987Match = rawValue.match(/^[^']*'[^']*'(.+)$/);
```

现在兼容：
- `UTF-8''demo.docx`
- `UTF-8'en'%E6%B5%8B%E8%AF%95.docx`

## 错误处理约定

- 所有错误使用 `RemoteUrlError` 类，带 `code` / `message` / `url` 三字段
- `page.tsx` 中 catch 使用 `toast.error` + Open 按钮，不使用 `console.error`
- CORS 失败时提供 `window.open(url, "_blank")` 作为兜底
- 远程 URL 加载失败是业务可预期失败，不触发开发红屏

## 待补充测试

建议为 `remote-url.ts` 核心函数补单测：

| 测试用例 | 预期 |
|---|---|
| 普通 `.docx` URL | fileType = docx |
| CNIPA downfile.jsp + showname=xxx.docx | fileType = docx |
| `.ppt` URL + OLE magic | MIME 不被 x-ole-storage 覆盖 |
| `.m4a` URL + ftyp magic | 不误判 video |
| `application/octet-stream` + `.xlsx` | fileType = xlsx |
| `filename*=UTF-8'en'%E6%B5%8B%E8%AF%95.docx` | 解析为 `测试.docx` |
| 无效 URL `abc` | INVALID_URL 错误 |
| `ftp://` 协议 | UNSUPPORTED_PROTOCOL 错误 |
