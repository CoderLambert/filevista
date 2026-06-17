# `@filevista/file-preview` Roadmap

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

### [ ] 4. 重依赖改 optional peer ★（最大价值）

**问题**：用户只想用 markdown 预览，也得装 80MB 的 `pdfjs-dist`/`exceljs`/`pptx-preview`/...

**方案**：

```jsonc
"peerDependencies": {
  "react": "^18.2.0 || ^19.0.0",
  "react-dom": "^18.2.0 || ^19.0.0",
  "pdfjs-dist": "^4.4.0",
  "exceljs": "^4.4.0",
  "docx-preview": "^0.3.7",
  "pptx-preview": "^1.0.7",
  "rtf.js": "^3.0.9",
  "jszip": "^3.10.1"
},
"peerDependenciesMeta": {
  "pdfjs-dist": { "optional": true },
  "exceljs": { "optional": true },
  "docx-preview": { "optional": true },
  "pptx-preview": { "optional": true },
  "rtf.js": { "optional": true },
  "jszip": { "optional": true }
},
"dependencies": {
  // 仅保留所有插件都用得上的：
  "dompurify": "^3.4.8",
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "shiki": "^4.1.0"
}
```

**配套修改**：

- 各 plugin 的 `load()` 已经 dynamic import → 运行时按需加载，不缺什么报错信息
- 但需要包装 import 失败的提示，告诉用户"想用 PDF 预览请 `pnpm add pdfjs-dist`"
- README 加"按需安装"章节

**参考**：`react-pdf`、`@uiw/react-md-editor` 都是这个模式。

### [ ] 5. 收紧公共 API 边界

`utils.ts` 的所有内部工具（`generateId`、`formatFileSize`、`base64ToUint8Array`）都从 `index.ts` re-export，发版后 SemVer 锁死无法重构。

**方案**：

- 把对外的 `FileType` / `FileInfo` 抽到 `core/types.ts`
- `utils.ts` 内部用，从 `index.ts` 移除
- 真有外部需要再单独导出（`@filevista/file-preview/utils` 子路径）

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

### [ ] 7. 补核心渲染路径的测试

现有：工具函数 + 状态机 + LargeFileHint + UnsupportedPluginPreview。
**缺**：

- `PluginPreviewRenderer` 的 plugin 解析 / 缓存 / 错误边界
- `core/source.ts` 的 4 种 source 读取
- `processRemoteUrl` 的 magic-byte sniffing
- 至少 1-2 个 preview adapter（mock 底层 lib，断言调用契约）

不要求 e2e 真实渲染，单测覆盖契约即可。

### [ ] 8. 解锁 `pdfjs-dist` 版本

```diff
- "pdfjs-dist": "4.4.168"
+ "pdfjs-dist": "^4.4.0"
```

完成 #4 后这个会自动从 `dependencies` 移到 `peerDependencies`，让用户控制版本。

---

## P2 — 锦上添花

### [ ] 9. dist 体积优化

当前 `bundle: false` → 80+ 个 .js + 80+ 个 .map。

可选方向（互斥）：

- **A**：主入口 `bundle: true` 单文件，配合 subpath exports `@filevista/file-preview/plugins/pdf`
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

需要配合 `next.config.ts` 的 `transpilePackages: ["@filevista/file-preview"]`。

可选——保持当前"build → typecheck"工作流也合理，更确定性。

### [ ] 11. CI 工作流

`.github/workflows/` 是 monorepo 拆分前的旧结构，需要重写：

- `ci.yml`：lint + typecheck + test + build:lib + build:playground 矩阵（Node 22.x）
- `release.yml`：tag → npm publish（配合 changesets）

### [ ] 12. 版本管理工具

引入 [`changesets`](https://github.com/changesets/changesets)：

```bash
pnpm add -D -w @changesets/cli
pnpm changeset init
```

PR 里写 changeset，merge 后自动出 `changeset version` PR，再 merge 即发版。

### [ ] 13. README 增强

补充：

- bundle size badge（bundlejs.com / bundlephobia）
- 浏览器兼容矩阵（Chrome 90+ / Safari 14+ / Firefox 88+）
- "只用 PDF 预览"最小示例（#4 完成后）
- API 参考链接（typedoc 自动生成）

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
