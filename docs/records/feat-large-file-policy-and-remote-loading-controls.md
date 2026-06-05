# feat: add large file policy and remote loading controls (Stage 18.1)

## 改动背景

Stage 18.0 完成 Source-first 数据模型清理后，Stage 18.1 聚焦"文件加载体验"改进：
- 大文件预览前缺乏风险提示和确认机制
- 远程 URL 加载不支持取消、无下载进度
- 用户无法判断加载是否卡死

## 改动方案

### 1. 统一大文件策略
新增 `performance-limits.ts`，定义三级阈值：
| 级别 | 大小 | 行为 |
|------|------|------|
| normal | < 20MB | 正常预览 |
| warning | 20-50MB | 显示提示，不阻止 |
| confirm | 50-100MB | 需用户确认后预览 |
| block | >= 100MB | 阻止预览，提供下载 |

### 2. LargeFileGate 组件
新增 `LargeFileGate.tsx`，包在 `PluginPreviewRenderer` 外层：
- warning 级别显示顶部提示条，预览正常渲染
- confirm 级别显示确认弹窗（Preview anyway / Download）
- block 级别显示阻止界面，仅提供下载按钮
- 确认后通过 `Set<string>` 记住确认状态

### 3. Source Reader 支持 AbortSignal
修改 `core/source.ts` 三个读取函数，新增 `ReadSourceOptions = { signal? }` 参数：
- `readSourceAsArrayBuffer` / `readSourceAsText` / `readSourceAsBase64`
- File/Blob 源读取前检查 `signal.aborted`（无法真正中途取消）
- URL 源将 signal 透传给 fetch（可真正取消）

### 4. 远程 URL 下载进度
修改 `remote-url.ts`：
- 新增 `RemoteLoadProgress` 类型（received / total / percent）
- 新增 `ProcessRemoteUrlOptions` 接口（signal / onProgress）
- 新增 `readResponseAsArrayBufferWithProgress()` 流式读取
- 支持 `Content-Length` 可读时显示百分比，不可读时显示已下载大小
- 识别 `AbortError` 并抛出 `RemoteUrlError("ABORTED", ...)`
- 新增 `ABORTED` / `FILE_TOO_LARGE` 错误码

### 5. 页面集成
修改 `page.tsx`：
- 新增 `previewConfirmedFileIds` 状态
- 新增 `remoteAbortRef` / `remoteProgress` 状态
- URL 加载支持 abort controller 和 progress callback
- URL 按钮 loading 时变为 "Cancel"
- URL 输入区下方显示进度条
- `PluginPreviewRenderer` 包裹 `LargeFileGate`

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `performance-limits.ts` | 新增 | 大文件策略阈值和策略函数 |
| `LargeFileGate.tsx` | 新增 | 大文件预览门禁组件 |
| `__tests__/performance-limits.test.ts` | 新增 | 策略阈值单元测试（15 case） |
| `core/source.ts` | 修改 | 读取函数增加 AbortSignal 支持 |
| `remote-url.ts` | 修改 | 远程 URL 支持取消和流式进度 |
| `page.tsx` | 修改 | 集成门禁、取消、进度 UI |

## 关键设计决策

1. **LargeFileGate 在外层**：确保确认前 Adapter 不会开始读取大文件，符合 source-first 策略
2. **远程文件大小不在下载前检查**：Content-Length 跨域不一定可读，统一由 LargeFileGate 在下载完成后控制
3. **File/Blob 无法真正取消**：只能在读取前检查 aborted，远程 fetch 才能真正取消
4. **进度降级**：Content-Length 不可读时只显示已下载大小，不显示百分比条

## 后续修正

首次提交后发现 3 个问题，已在 `fix: polish remote loading cancel behavior` 中修复：

1. **URL 按钮双 Cancel 文本**：原来按钮内部两个三元表达式同时渲染导致 "CancelCancel"，改为统一单三元
2. **Enter 键重复触发远程请求**：loading 中按 Enter 会创建新 AbortController 发起新请求，改为 loading 中按 Enter 触发取消，并在 `loadRemoteUrl` 开头加 `loadingRemoteUrl` 防重入
3. **Stream AbortError 未统一转为 RemoteUrlError**：`readResponseAsArrayBufferWithProgress` 抛出的 `DOMException` 没有被 `processRemoteUrl` 捕获，统一收归到同一个 try/catch 中，确保任何阶段的 AbortError 都能转为 `RemoteUrlError("ABORTED")` 并被 page.tsx 正确识别

## 验收标准

- [x] 统一 PREVIEW_SIZE_LIMITS
- [x] getPreviewSizePolicy() 函数
- [x] 大于 20MB 文件显示 warning
- [x] 大于 50MB 文件需要确认后预览
- [x] 大于 100MB 文件默认阻止浏览器预览
- [x] 本地文件选择后不立即读取内容
- [x] LargeFileGate 在 PluginPreviewRenderer 外层生效
- [x] 远程 URL 加载支持 AbortController
- [x] 远程 URL 加载中可以取消
- [x] 取消后不红屏、不显示错误 toast
- [x] 远程 URL 加载支持 downloaded bytes
- [x] Content-Length 可读时显示百分比
- [x] Content-Length 不可读时显示已下载大小
- [x] CORS 失败仍有 Open 原链接兜底
- [x] source-first 架构不回退到 content/base64 主链路
- [x] `bun run lint` 通过
- [x] `bun run build:pages` 通过
- [x] `vitest run performance-limits` 15/15 通过

## 验证结果

```
✓ bun run lint — 通过（0 errors）
✓ bun run build:pages — 通过（Compiled successfully in 17.3s）
✓ vitest run performance-limits.test.ts — 15 pass, 0 fail
```

## 后续阶段

- Stage 18.2：错误边界与 Plugin fallback
- Stage 18.3：Worker 化重任务
