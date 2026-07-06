# feat: configurable large file policy with i18n and error reporting

## 改动背景

Stage 18.1 引入 `LargeFileGate` 后，大文件预览策略只有 20/50/100 MB 三档硬编码阈值，调用方无法按业务场景自定义（例如内部系统允许 200 MB、移动端限制 10 MB）。本轮改动将策略升级为可配置 API，并补齐统一错误上报、自定义降级 UI、i18n 国际化与若干审查发现的 bug 修复。

### 主要问题

1. `largeFilePolicy` 仅接受 `"default" | "off"`，无法自定义阈值
2. `LargeFileGate` 内文案全硬编码英文，与项目 i18n 体系脱钩（违反 CLAUDE.md「zero hardcoded Chinese/English」规范）
3. `blockReportedRef` 用布尔 ref 去重，同名同 size 文件切换时漏报 `onError`
4. `downloadSource` 一律 `readSourceAsArrayBuffer` 再 `new Blob`，对 `File`/`Blob` 源是无谓拷贝；`url` 带headers 时 fetch 错误是普通 `Error`，与 `onError: (PreviewError) => void` 契约不一致
5. `validatePreviewSizePolicy` 只校验 `<= 0`，未检查 `Infinity` / `NaN`，运行时会落入「warning 永不触发」的死代码路径
6. demo 中 `TIERED_POLICY.maxBytes: 5MB` 与 `confirmBytes: 35MB` 关系非法，UI 文案又与配置值脱钩

## 改动方案

### 1. 可配置策略 API

新增 `LargeFilePolicy` 联合类型与两个辅助函数：

```ts
type LargeFilePolicy = "default" | "off" | PreviewSizePolicyConfig;

interface PreviewSizePolicyConfig {
  maxBytes: number;
  warningBytes?: number | null;  // null 表示禁用该档
  confirmBytes?: number | null;
}

function validatePreviewSizePolicy(policy: PreviewSizePolicyConfig): void;
function resolvePreviewSizePolicy(policy: LargeFilePolicy): ResolvedPreviewSizePolicy;
```

`getPreviewSizePolicy` 返回值新增 `maxBytes` 和 `actualBytes` 字段，便于 UI/埋点直接读取阈值。

`validatePreviewSizePolicy` 校验：
- `maxBytes` 必须是正有限数
- `warningBytes` / `confirmBytes` 若提供必须是正有限数
- `warningBytes < confirmBytes < maxBytes`

### 2. LargeFileGate 增强

接受 `policy` / `onError` / `renderBlockedFallback` 三个新 prop：

- `policy: LargeFilePolicy` — 自定义阈值，`disabled=true` 等价于 `policy="off"`
- `onError: (PreviewError) => void` — 文件被 block 时上报 `FILE_TOO_LARGE`，含 `actualBytes` / `maxBytes` / `fileType` details
- `renderBlockedFallback: (ctx) => ReactNode` — 自定义降级 UI，ctx 提供 `file` / `actualBytes` / `maxBytes` / `download`

默认 block UI 收敛到 `PreviewFallback kind="file-too-large"`，与其他错误态视觉一致。

### 3. block 上报去重修复

原 `blockReportedRef` 用布尔 ref，effect 依赖 `file.name` / `file.size` / `file.fileType`，导致同名同 size 文件切换时漏报。改为 `useRef<string | null>` 存组合 key：

```ts
const reportKey = `${file.id}::${file.size}::${file.name}`;
```

`file.id` 是 `FileInfo.id` 必填字段，加 `size`+`name` 兜底是为了在调用方违反契约（复用同一 id 给不同文件）时仍能正确重新上报。

### 4. download 重构

按源类型分支：

| 源类型 | 路径 |
|--------|------|
| `file` / `blob` | 直接 `URL.createObjectURL`，避免 ArrayBuffer 拷贝 |
| `arrayBuffer` | `new Blob([buffer], { type })` |
| `url` 无 headers | `<a download={url}>` 直接触发，免去 fetch |
| `url` 有 headers | `fetch` + `response.blob()` |

`mimeType` 参数现在覆盖响应 `Content-Type`（修复服务器返回错误 MIME 时不生效的问题）。fetch 失败与 HTTP 非 2xx 规范化为 `PreviewError`：

- 网络错误 / CORS 拒绝 → `REMOTE_CORS_ERROR`
- HTTP 非 2xx → `REMOTE_HTTP_ERROR`（含 status / statusText details）

### 5. i18n 全覆盖

`LargeFileGate` 所有硬编码英文替换为 i18n 字段：

| 字段 | zh-CN | en-US |
|------|-------|-------|
| `fileTooLargeToPreview` | 文件过大，无法预览 | File too large to preview |
| `fileTooLargeBlockedDesc` | 文件大小 {actualSize}，超过最大预览限制 {maxSize}，请下载后查看。 | File size {actualSize} exceeds the maximum preview limit of {maxSize}. Please download to view. |
| `largeFilePreviewTitle` | 大文件预览 | Large file preview |
| `previewAnyway` | 继续预览 | Preview anyway |
| `largeFileWarningBanner` | 大文件：{fileSize}，预览可能较慢。 | Large file: {fileSize}. Preview may be slower. |

占位符 `{actualSize}` / `{maxSize}` / `{fileSize}` 用 `.replace()` 替换，与项目其他 i18n 占位符用法一致。

### 6. demo UI 文案从 policy 派生

`large-file-policy-demo.tsx` 新增 `formatPolicyLabel(policy)` 工具函数，从 `LargeFilePolicy` 对象派生展示文案，消除原 14 行三元硬编码字符串。现在改 policy 常量，UI 标签自动同步，不会再出现「文案写 50MB，代码却是 5MB」的脱钩 bug。

### 7. PluginPreviewRenderer 重构

把「无 plugin 支持」分支和「正常 plugin」分支合并到一个 `content` 变量，最后统一走 `LargeFileGate` 包装。修复了原来 unsupported 文件绕过 gate 的问题。

### 8. 用户输入安全模式

`validatePreviewSizePolicy` 在 `maxBytes <= 0` / `NaN` / `Infinity` 时抛 `TypeError`，是「开发者错误」契约。用户输入场景必须由调用方先 try/catch 再传：

```tsx
const policy = useMemo(() => {
  const maxBytes = userMB * 1024 * 1024;
  try {
    validatePreviewSizePolicy({ maxBytes });
    return { maxBytes };
  } catch {
    return "default";
  }
}, [userMB]);
```

README 已补充此模式说明。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| packages/file-preview/src/performance-limits.ts | 修改 — 新增 LargeFilePolicy 类型、validate/resolve 函数，加 Infinity/NaN 校验 |
| packages/file-preview/src/LargeFileGate.tsx | 修改 — 接受新 props，全 i18n 化，blockReportedRef 改用 id+size+name key |
| packages/file-preview/src/PluginPreviewRenderer.tsx | 修改 — 透传 largeFilePolicy/renderLargeFileFallback，unsupported 分支也走 gate |
| packages/file-preview/src/core/download.ts | 修改 — 按源类型重构，mimeType 覆盖响应，错误规范化为 PreviewError |
| packages/file-preview/src/core/i18n.ts | 修改 — 新增 5 个 locale 字段（中英文） |
| packages/file-preview/src/index.ts | 修改 — 导出新类型/函数 |
| packages/file-preview/tsup.config.ts | 修改 — 排除 src/**/*.d.ts |
| packages/file-preview/src/css.d.ts | 新增 — CSS 模块声明 |
| packages/file-preview/src/__tests__/performance-limits.test.ts | 修改 — 新策略覆盖测试（+161 行） |
| packages/file-preview/src/__tests__/PluginPreviewRenderer.test.tsx | 修改 — 自定义 policy 测试 + LocaleProvider 包裹（+170 行） |
| apps/playground/src/app/large-file-policy-demo.tsx | 新增 — 4 种策略切换 demo |
| README.md | 修改 — 新增「大文件预览策略」小节 + Roadmap 标注 |

## 验证结果

| 验证 | 命令 | 结果 |
|------|------|------|
| 类型检查 | `pnpm run typecheck` | ✅ packages/file-preview + apps/playground 全部通过 |
| 单元测试 | `pnpm exec vitest run`（file-preview 包） | ✅ 12 test files / 147 tests PASS / 0 FAIL |
| Lint | `pnpm exec eslint src/app/large-file-policy-demo.tsx`（playground） | ✅ exit 0 |

## 兼容性

- `LargeFilePolicy` 联合类型保留 `"default" | "off"`，老调用方零改动
- `LargeFileGate.disabled` 仍可用，等价于 `policy="off"`
- `getPreviewSizeLevel` 仍导出但仅用默认阈值（grep 确认无业务调用方，仅测试使用）
- `downloadSource` 公开签名不变，新增错误类型对调用方是兼容的（普通 `Error` → `PreviewError`，`PreviewError extends Error`）
