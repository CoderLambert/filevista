# `@lamberl-lee/file-preview` Roadmap

> Optimization plan for the library after the pnpm monorepo split (2026-06).
> Status snapshots and follow-ups go in this file; tick items as they land.

## 现状速览（基线）

- **打包体积**：tarball ~200KB / 解压 1.6MB / 280 文件（`tsup` `bundle: false`，保留模块结构）
- **依赖体积**：`pdfjs-dist` + `exceljs` + `pptx-preview` + `docx-preview` + `rtf.js` + `shiki` ≈ ~80MB（lazy 加载只省 runtime bundle，不省 install）
- **测试**：6 个文件，全部为工具/状态机层；核心渲染路径无测试
- **元信息缺口**：`LICENSE` 文件、`CHANGELOG.md`、`repository`/`homepage`/`bugs`/`author`

---

## P0 — 发包前必须做

### [x] 1. 补全 `package.json` 元信息

```jsonc
"repository": {
  "type": "git",
  "url": "git+https://github.com/CoderLambert/filevista.git",
  "directory": "packages/file-preview"
},
"homepage": "https://github.com/CoderLambert/filevista#readme",
"bugs": "https://github.com/CoderLambert/filevista/issues",
"author": "CoderLambert"
```

**Why**：缺这些字段 npm 页面不展示仓库链接，搜索权重低。

### [x] 2. 添加 `LICENSE` 文件

`package.json` 写了 `"license": "MIT"`，但包里没实际 MIT 文本——发出去等于法律真空。

- 在 `packages/file-preview/LICENSE` 放标准 MIT 文本
- 在 `package.json` 的 `files` 里追加 `"LICENSE"`

### [x] 3. `pnpm pack --dry-run` 检查打包内容

```bash
cd packages/file-preview && pnpm pack --dry-run
```

确认 tarball 里没有 `node_modules`、`.test.tsx`、`vitest.config.ts` 等开发文件。

**结果**：281 个文件，全部命中 `dist/`、`scripts/`、`LICENSE`、`package.json`、`README.md` 白名单；无开发文件泄漏。

---

## P1 — 高价值优化

### [x] 4. 重依赖改 optional peer ★（最大价值）

**改动**：6 个重 deps 从 `dependencies` 转入 `peerDependencies` + `peerDependenciesMeta.optional: true`。

| Format | Peer dep |
| --- | --- |
| PDF | `pdfjs-dist` (^4.4.0) |
| DOCX | `docx-preview` (^0.3.7) |
| XLSX | `exceljs` (^4.4.0) |
| PPTX | `pptx-preview` (^1.0.7) |
| RTF | `rtf.js` (^3.0.9) |
| ZIP / EPUB | `jszip` (^3.10.1) |

`dependencies` 收敛到 4 个所有插件共用的轻量包：`dompurify` / `react-markdown` / `remark-gfm` / `shiki`。

**配套修改**：

- `core/plugin.ts` 加 `loadWithOptionalDep(loader, { package, featureLabel })` + `MissingPeerDependencyError` 类。检测 5 种 bundler/runtime 的"模块未找到"错误形态（Webpack / Turbopack / 原生 ESM / Vite / Metro），失败时改写成"装这个包"的提示
- 6 个重 plugin (`pdf`/`docx`/`xlsx`/`pptx`/`rtf`/`zip`+`epub`) 用 `loadWithOptionalDep` 包装 `load()`
- `scripts/copy-pdf-worker.mjs` / `copy-rtfjs-bundles.mjs`：改成 graceful skip——找不到包时输出友好提示并 `exit 0`，不再抛 `require.resolve` 堆栈
- `apps/playground/package.json` 同步把 6 个 deps 显式声明为 dependencies（playground 是消费方，不能依赖 hoisting）
- README 大改：新增"按需安装"表格、解释 fallback 机制、说明 postinstall 脚本是按需的

#### [x] 8. 解锁 `pdfjs-dist` 版本

随 #4 自动完成：`"pdfjs-dist": "4.4.168"` → `"^4.4.0"`（在 peer 上），消费方自行控制具体版本。

### [x] 5. 收紧公共 API 边界

`utils.ts` 原本导出 11 个符号且全部从 `index.ts` 直通；其中只有 `detectFileType` + 类型是真正的对外 API，其它是颜色/标签/格式化/id 这种 app-level UI 约定，发包后会被 SemVer 锁死。

**实际改动**：

- `core/types.ts` 接收 `FileType` / `FileInfo` / `ALL_FILE_TYPES` 的权威定义（顺手破除 `utils.ts ↔ core/types.ts` 的循环依赖）
- `utils.ts` 改为从 `core/types.ts` re-export 类型，保留所有 helper 给内部使用
- `index.ts` 收紧：从原来的 11 个 utils 导出 → 只剩 `detectFileType` + 类型
- Playground 把删掉的 7 个 helper 内联到 `apps/playground/src/lib/file-helpers.ts`（包括 Tailwind palette 的 `getFileTypeColor`/`getFileTypeLabel`，本来就是 playground 的 UI 约定，应该归 app 拥有）

**对外消失的 API**：`generateId`、`formatFileSize`、`base64ToUint8Array`、`getFileExtension`、`getLanguageFromFilename`、`getFileTypeColor`、`getFileTypeLabel`。需要二进制读取的消费者用 `readBinaryPreviewAsArrayBuffer` / `readBinaryPreviewAsUint8Array`（公开稳定 API）。

### [x] 6. 清理迁移残留

确认 4 类候选后实际删除了 5 个源文件 + 3 个 CSS + 1 个测试：

**真重复（删）**：

- `src/UnsupportedPluginPreview.tsx` —— 与 `src/preview-adapters/UnsupportedPluginPreview.tsx` 字节相同；只有 adapter 版本被 `PluginPreviewRenderer` 引用

**死代码 orphan（删）**：

- `src/DocPreview.tsx` + `src/styles/DocPreview.css`
- `src/LargeFileHint.tsx` + `src/styles/LargeFileHint.css` + `src/__tests__/LargeFileHint.test.tsx`
- `src/UnsupportedLegacyOfficePreview.tsx` + `src/styles/UnsupportedLegacyOfficePreview.css`

均无 importer，仅自引用 + `styles/index.css` 的 `@import`（已同步清理）。

**保留（不是重复）**：

- `src/CodePreview.tsx`（pure render） + `src/preview-adapters/SourceCodePreviewAdapter.tsx`（I/O glue）—— 这是有意的分层模式，其他 adapter 同样架构。

### [x] 7. 补核心渲染路径的测试

**新增 3 个文件、+47 个测试用例**（6→41→88）：

- `src/__tests__/source.test.ts`（+31 用例）—— 覆盖 `readSourceAsArrayBuffer` / `readSourceAsText` / `readSourceAsBase64` / `createObjectUrlFromSource` / `getSourceName` / `getSourceMimeType` / `getSourceSize` 全部 4 种 source 变体（file / blob / arrayBuffer / url），包括 abort signal / fetch 错误 / base64 分块边界
- `src/__tests__/plugin-load.test.ts`（+11 用例）—— 覆盖 `loadWithOptionalDep` 成功路径、5 种 bundler/runtime 的 module-not-found 格式（Webpack / Turbopack / 原生 ESM / Vite / Metro）、无关错误透传、非 Error 拒绝
- `src/__tests__/PluginPreviewRenderer.test.tsx`（+5 用例）—— 覆盖 plugin 匹配路由 + 无匹配 fallback + debug bar 切换 + load 错误回退 + promise 缓存去重（使用 `act` 包装 React 19 `use()` + Suspense）
- 删掉 `src/__tests__/LargeFileHint.test.tsx`（#6 清理的 5 个 orphan 之一）

**仍缺暂不补**（P2）：

- `processRemoteUrl` magic-byte sniffing（需要 mock fetch + file magic sniff）
- preview adapter 集成测试（mock 底层 lib 并断言调用契约）

### [x] 8. 解锁 `pdfjs-dist` 版本

随 #4 完成（见上）。

---

## P2 — 锦上添花

### [ ] 9. dist 体积优化

当前 `bundle: false` → 80+ 个 .js + 80+ 个 .map。

可选方向（互斥）：

- **A**：主入口 `bundle: true` 单文件，配合 subpath exports `@lamberl-lee/file-preview/plugins/pdf`
- **B**：保持现状，但启用 `experimentalDts` 合并 d.ts

A 是较大架构改动，建议 0.2 版本再做。

### [ ] 10. Monorepo 即时开发

让 playground 不用每次都 build:lib：

```jsonc
"exports": {
  ".": {
    "source": "./src/index.ts",       // bundler 用源码
    "types": "./dist/index.d.ts",     // tsc 用编译产物
    "import": "./dist/index.js"
  }
}
```

需要配合 `next.config.ts` 的 `transpilePackages: ["@lamberl-lee/file-preview"]`。

可选——保持当前"build → typecheck"工作流也合理，更确定性。

### [x] 11. CI / Release 工作流

- `ci.yml` 已在 `449964b` 重写为 pnpm + monorepo（lint + typecheck + test + build）
- 新增 `release.yml`：changesets 双触发——push 带 pending changeset → 开 Version Packages PR；PR merge 后 → `changeset publish` 发 npm。配置 npm provenance（OIDC `id-token: write`）+ 完整 history（changelog diff 需要）
- 需要仓库 secret：`NPM_AUTH_TOKEN`（npm "Automation" token）

### [x] 12. 版本管理工具

- 安装 `@changesets/cli`（root devDep）
- `.changeset/config.json`：`access: public`、`ignore: ["@lamberl-lee/playground"]`（private 包不发版）
- root package.json 加 `changeset` / `version` / `release` 脚本
- 首发 changeset：`.changeset/initial-release.md`（minor bump 0.1.0 → 0.2.0）

### [x] 13. README 增强

- npm version / bundlephobia minzip / license / CI status 四个 shield badge
- 浏览器兼容矩阵章节（Chrome 90+ / Firefox 88+ / Safari 14+）
- License 章节说明 LGPL-3.0-or-later + COPYING（GPL-3.0）

**仍未做**：typedoc 自动生成 API 参考链接（#14 一起或单独视需求）。

### [ ] 14. CJS 输出（视需求）

当前只 ESM。React 19 + 现代工具链够用；Jest 老配置/部分 Node 工具会报错。
**结论**：等真有用户报问题再加，避免维护负担。

---

## 0.3.0 — 生产可接入版本

> **核心**：把库从"功能多"打磨成"接入不踩坑"——默认安全 / 默认防大文件 / 错误可兜底 / 依赖可解释 / 格式边界清楚。
> 0.2.0 已发 npm（`@lamberl-lee/file-preview@0.2.0`），0.3.0 为下一个版本。

### [x] 1. React 18 兼容修正

**问题**：`peerDependencies` 写了 `react ^18.2 || ^19`，但 `PluginPreviewRenderer.tsx:48` 用了 React 19-only 的 `use(promise)`——React 18 一进预览就崩，"支持 18" 是空话。

**改动**（`a5fb84d`）：
- `PluginContent` 从 `use()` + `Suspense` 改为显式状态机（`loading` / `error` / `ready`），只用 `useEffect`/`useState` 等 16.8+ API
- 不用 `React.lazy`：它内部缓存 promise 会破坏 `invalidatePluginPromise` 的 retry 机制
- Suspense 包裹移除（PluginContent 自己渲染 loading）

**CI 矩阵**（`fa3b770`）：新增 `react18-compat` job，pnpm-workspace.yaml overrides 强行装 React 18.3.1，跑库测试套件。`require('react').version === 18.3.1` 实际验证过，不是"代码里没 use() 就算"。

### [x] 2. 大文件保护默认内置

**问题**：`LargeFileGate` 之前要业务方手动包，一忘就裸奔。

**改动**（`957a2fa`）：
- `<PluginPreviewRenderer file={file} />` 默认套 `LargeFileGate`；新增 `largeFilePolicy: "default" | "off"` 切换
- `LargeFileGate` 重构为自包含：内部管 confirm 状态，`file.id` 变化自动 reset
- 修复一个 latent bug：原 warning 分支只显示警告条 + 不渲染预览（warning-tier 文件根本看不到）
- Playground 删掉手动 `LargeFileGate` 包裹 + `previewConfirmedFileIds` Set + onConfirm

**阈值**（`PREVIEW_SIZE_LIMITS`，未变）：20MB warn / 50MB confirm / 100MB block。

### [x] 3. 远程 URL 限制 maxBytes

**问题**：`processRemoteUrl` 之前先 fetch 完再让 LargeFileGate 决定——那时浏览器内存已经爆了。

**改动**（`31e65f1`）：
- `ProcessRemoteUrlOptions.maxBytes`，默认 `DEFAULT_REMOTE_MAX_BYTES = 100 * 1024 * 1024`
- 双路径：`Content-Length` 头超限 → 预检拒绝，零字节传输；无 `Content-Length` → 流读到 `received > maxBytes` 时 `reader.cancel()`
- 命中限制抛 `RemoteUrlError(code: "FILE_TOO_LARGE")`
- `maxBytes: Infinity` 关闭限制

**测试**（+12）：覆盖预检 / 流式中断 / 默认值生效 / Infinity 跳过 / `RemoteUrlError instanceof` 契约。

### [x] 4. 本地文件 magic bytes 检测

**完成**：新增统一检测 API：

```ts
const meta = await detectFileMeta(source);
// { fileType, mimeType, fileName, confidence, detectBy }
```

**改动**：
- `core/magic-bytes.ts`：从 `remote-url.ts` 抽出 `sniffMagic` / `sniffZipContainer`，成为本地文件与远程 URL 共用的 byte-level 检测源
- `core/detect-meta.ts`：新增 `detectFileMeta(source)`，返回 `{ fileType, mimeType, fileName, confidence, detectBy }`
- `remote-url.ts`：复用 `core/magic-bytes.ts`，避免两套 magic 逻辑漂移
- Playground 本地上传：`processFile()` 改用 `detectFileMeta({ kind: "file", file })`，所以 `.pdf` 改名 `.txt` / 空 MIME DOCX 等场景能按真实内容识别
- `index.ts`：导出 `detectFileMeta`、`sniffMagic`、`sniffZipContainer` 及相关类型

**覆盖范围**：
- PDF / PNG / JPG / GIF / WebP magic
- ZIP container → docx / pptx / xlsx / epub
- OLE magic → legacy Office（doc/xls/ppt 仍按扩展名区分具体类型）
- fallback：扩展名 → MIME → unknown

**测试**：`detect-meta.test.ts` 覆盖 magic 优先于错误扩展名、ZIP container、OLE、extension fallback、MIME fallback。

### [ ] 5. PreviewError 标准化错误码

**目标**：业务方能 `error.code === "MISSING_PEER_DEPENDENCY"` 做兜底。

```ts
type PreviewErrorCode =
  | "MISSING_PEER_DEPENDENCY"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "REMOTE_CORS_ERROR"
  | "REMOTE_HTTP_ERROR"
  | "PARSE_FAILED"
  | "RENDER_FAILED"
  | "SECURITY_BLOCKED";
```

**改动**：
- 新建 `core/preview-error.ts`：`PreviewError` 类 + 联合类型
- 把现有 `MissingPeerDependencyError` / `RemoteUrlError` / `PreviewPluginLoadError` 都收编进 `PreviewError`（保留旧类作为子类，向后兼容)
- `PluginPreviewRenderer` 加 `onError(error: PreviewError)` 回调
- 测试覆盖每个 code 的契约稳定性（未来重构 message 不会破坏 code）

### [x] 6. supported-formats.md

**问题**：README 头部"20+ formats"暗示了 Word/Excel 级别的还原度——这是产品侧最大的预期错位源。

**改动**（`ee4ffc9`）：新文件 `docs/supported-formats.md`，三栏表（底层渲染器 / 我们能渲染什么 / 我们**明确不保证**什么）。Office 系明示：不像素级、不重算公式、不放动画、不播嵌入媒体。配套：安全策略、性能阈值、optional peer 表、浏览器矩阵。`package.json` `files` 加 `docs`，README 顶部加引导链接。

### [ ] 7. ★ 高阶组件 `<FilePreview />`（0.4.0 候选 — 暂列在此处提醒）

```tsx
<FilePreview file={file} />
<FilePreview url={url} />
```

内部自动构造 `FileInfo` + 调用 `processRemoteUrl` + 套 `LargeFileGate` + 兜底缺依赖提示 + 暴露 `onError` / `onLoad` / `onUnsupported`。底层 `<PluginPreviewRenderer file={fileInfo} />` 保留给高级用户。

> 这条放 0.4.0；0.3.0 先把 #4 / #5 完成。

---

## 0.3.0 进度

| # | 项 | 状态 | commit |
| --- | --- | --- | --- |
| 1 | React 18 兼容 | ✅ + CI 矩阵 | `a5fb84d` + `fa3b770` |
| 2 | 大文件保护默认内置 | ✅ | `957a2fa` |
| 3 | 远程 URL maxBytes | ✅ | `31e65f1` |
| 4 | 本地 magic bytes 检测 | ⏳ | — |
| 5 | PreviewError 标准化 | ⏳ | — |
| 6 | supported-formats.md | ✅ | `ee4ffc9` |

发版条件：6 项全部完成 → 写 changeset minor → merge Version Packages PR → CI 自动 publish。

---

## 推荐执行顺序

| 时间 | 任务 |
| --- | --- |
| 今天 | #1 元信息 / #2 LICENSE / #3 dry-run |
| 本周 | #4 optional peer deps（最大价值的一次重构） |
| 本周 | #5 API 边界 / #6 冗余清理 |
| 发包前 | #7 补核心测试 |
| 发版后 | #11 CI / #12 changesets |
| 按需 | #8 / #9 / #10 / #13 / #14 |

---

## 备注

- 基线 commit：`4fe769d`（pnpm monorepo 重构）+ `ab7d0bc`（@filevista → @lamberl-lee scope 改名 + 0.2.0 准备）
- 0.2.0 已发到 npm：https://www.npmjs.com/package/@lamberl-lee/file-preview
- 完成一项就在本文件勾选 `[x]` 并把 commit hash 填进对应表格
- 大改动（如 #4 magic bytes、#5 错误码体系）建议单独 commit，便于回滚
