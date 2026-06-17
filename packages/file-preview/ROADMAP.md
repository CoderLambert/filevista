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

- 所有版本号、文件路径以 commit `4fe769d`（pnpm monorepo 重构）为基线
- 完成一项就在本文件勾选 `[x]` 并提交
- 大改动（如 #4、#9A）建议单独开 PR，便于回滚
