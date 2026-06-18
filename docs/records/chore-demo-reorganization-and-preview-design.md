# chore + refactor + docs: Demo 文件整理、自动生成系统与设计文档

## 改动背景

Playground 的 demo 文件管理存在以下问题：

1. **Demo 文件散落在 `upload/` 目录**：部分 demo 文件放在项目根 `upload/` 目录，与正式的 `apps/playground/public/demo/` 目录不一致，导致加载路径混乱。
2. **Demo 列表硬编码**：`src/lib/demos.ts` 包含 430+ 行硬编码的 demo 内容（Markdown、JSON、代码片段等内联字符串），每次新增/替换 demo 都需要手动编辑代码。
3. **缺少大文件管理策略**：Office 文档、PDF、EPUB 等二进制 demo 文件体积较大，直接 Git 追踪导致仓库膨胀。
4. **缺少 CSV/RTF 预览设计文档**：这两个文件类型的预览方案已有调研结论，但未沉淀为项目文档。

## 改动方案

### 1. Git LFS 配置（`chore`）

新增 `.gitattributes` 配置 LFS 追踪大文件类型：
- Office 文档（`.pptx`、`.xlsx`、`.docx` 等）
- 出版物（`.pdf`、`.epub`）
- Playground demo 目录下的大图片（`.png`、`.jpg` 等）

同时将 `upload/` 下的 demo 文件迁移到 `apps/playground/public/demo/`，替换掉过时的 demo 样本（旧 RTF、DOCX、XLSX），换成更真实的文件（PDF 报告、PPTX 模板、XLSX 数据表、截图等）。

### 2. Demo 自动生成系统（`refactor`）

新增 `scripts/sync-demos.mjs` 脚本：
- 扫描 `apps/playground/public/demo/` 目录下所有文件
- 根据扩展名推断 MIME 类型（覆盖 40+ 种扩展名）
- 生成 `src/lib/demos.generated.ts`，包含文件名、路径、MIME、大小等元信息

重构 `src/lib/demos.ts`：
- 删除 430+ 行硬编码的 `DEMO_FILES` 对象
- 改为从 `demos.generated.ts` 导入并导出

更新 `src/app/page.tsx`：
- 移除文本 demo 和二进制 demo 分开加载的逻辑
- 统一从自动生成的 manifest 加载所有 demo

更新 `package.json`：
- 新增 `sync:demos` 脚本
- 链入 `dev`、`build`、`build:pages`、`postinstall`，保持 manifest 自动同步
- `.gitignore` 忽略生成的 `demos.generated.ts`

**效果**：新增 demo 只需将文件放入 `public/demo/`，重启 dev server 即可自动出现在 playground 中，无需编辑任何代码。

### 3. 预览设计文档（`docs`）

- `docs/preview-plugin-dev/csv.md`：CSV 预览方案 — 默认 `Papa Parse + Web Worker + TanStack Table + TanStack Virtual`，高级模式可选 DuckDB-WASM
- `docs/preview-plugin-dev/rtf-preview-rendering-plan.md`：RTF 富文本渲染升级方案 — `rtf.js + DOMPurify + iframe sandbox`，失败降级为纯文本
- `docs/preview-plugin-dev/rtf.md`：RTF 集成指南摘要
- `docs/stage-17-release-experience-prd/stage-17-release-experience-prd.md`：修复尾部空白

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `.gitattributes` | 新增 — Git LFS 追踪规则 |
| `.gitignore` | 修改 — 忽略 `demos.generated.ts` |
| `apps/playground/package.json` | 修改 — 新增 `sync:demos` 脚本，链入生命周期 |
| `apps/playground/scripts/sync-demos.mjs` | 新增 — demo 目录扫描 + manifest 生成脚本 |
| `apps/playground/src/lib/demos.ts` | 重构 — 删除硬编码，改用自动生成 |
| `apps/playground/src/app/page.tsx` | 修改 — 统一 demo 加载入口 |
| `apps/playground/public/demo/*` | 迁移/新增/删除 — demo 文件整理 |
| `upload/*` | 删除 — 迁移至 `public/demo/` |
| `docs/preview-plugin-dev/csv.md` | 新增 — CSV 预览设计文档 |
| `docs/preview-plugin-dev/rtf-preview-rendering-plan.md` | 新增 — RTF 渲染升级方案 |
| `docs/preview-plugin-dev/rtf.md` | 新增 — RTF 集成指南 |
| `docs/stage-17-release-experience-prd/*.md` | 修改 — 尾部空白修复 |

## 验证结果

- ✅ `pnpm run typecheck` — `packages/file-preview` 和 `apps/playground` 均通过
- ✅ file-preview 包构建成功（tsup ESM + DTS）
