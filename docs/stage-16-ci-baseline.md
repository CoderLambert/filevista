# Stage 16: CI Baseline

## 1. 目标

16 阶段用于建立 FileVista 的基础工程验证流程。

本阶段目标不是继续扩展文件预览能力，而是保证每次提交至少经过以下验证：

```txt
lint
unit/component tests
production build
GitHub Pages 自动部署
```

---

## 2. 本地验证命令

提交前建议执行：

```bash
bun run check
```

该命令等价于：

```bash
bun run lint
bun run test:run
bun run build
```

验证 GitHub Pages 构建：

```bash
bun run build:pages
```

---

## 3. 单独验证命令

### 3.1 Lint

```bash
bun run lint
```

### 3.2 测试

```bash
bun run test:run
```

当前测试覆盖：

```txt
Plugin Registry 与 support-status 矩阵一致性
UnsupportedPluginPreview 组件交互
legacy Office 下载 MIME 类型
LargeFileHint 大文件提示展示规则
```

### 3.3 构建

```bash
# 独立模式（服务器/容器部署）
bun run build

# 静态导出（GitHub Pages）
bun run build:pages
```

---

## 4. GitHub Actions Workflows

### 4.1 CI 验证 workflow

文件：

```txt
.github/workflows/ci.yml
```

触发条件：

```txt
push 到 main/dev
pull_request 到 main/dev
```

执行步骤：

```txt
1. checkout repository
2. setup Bun（通过 .bun-version 固定版本）
3. bun install --frozen-lockfile
4. bun run lint
5. bun run test:run
6. bun run build（standalone 模式）
```

### 4.2 GitHub Pages 部署 workflow

文件：

```txt
.github/workflows/pages.yml
```

触发条件：

```txt
push 到 main
手动触发（workflow_dispatch）
```

执行步骤：

```txt
build job:
1. checkout repository
2. setup Bun
3. setup GitHub Pages
4. bun install --frozen-lockfile
5. bun run lint
6. bun run test:run
7. bun run build:pages（export 模式）
8. upload pages artifact

deploy job:
1. deploy to GitHub Pages
```

---

## 5. Next.js 配置

`next.config.ts` 通过环境变量切换输出模式：

```txt
本地/服务器构建：
output = standalone

GitHub Pages 构建：
NEXT_PUBLIC_DEPLOY_TARGET=github-pages
output = export
basePath = /filevista
assetPrefix = /filevista
trailingSlash = true
```

---

## 6. 静态资源路径

由于 GitHub Pages 挂载在 `/filevista/` 子路径下，项目中所有硬编码的静态资源路径都通过 `NEXT_PUBLIC_BASE_PATH` 环境变量自动适配：

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const workerSrc = `${basePath}/vendor/pdfjs/pdf.worker.min.mjs`;
```

当前已适配的资源：

```txt
PDF.js worker: /vendor/pdfjs/pdf.worker.min.mjs
Demo 文件: /demo/*.docx, /demo/*.xlsx, /demo/*.epub
```

---

## 7. Bun 版本

项目使用 `.bun-version` 固定 CI 中的 Bun 版本，避免 `latest` 造成不可预期变化。

查看当前版本：

```bash
cat .bun-version
```

---

## 8. TypeScript 类型检查

当前项目保留：

```bash
bun run typecheck
```

但暂不接入 CI 阻塞流程。原因：

```txt
next.config.ts 当前设置了 ignoreBuildErrors: true
直接把 typecheck 接入 CI 可能会引入历史类型债清理范围
```

后续可以单独开阶段处理：

```txt
Stage 17: TypeScript strictness and build error cleanup
```

---

## 9. 新增文件类型后的验证流程

新增文件类型后，需要执行：

```bash
bun run test:run
bun run build
bun run build:pages
```

如果影响 Plugin Renderer 行为，需要重点检查：

```txt
support-status.ts
builtin-plugins.ts
plugin-registry.test.ts
support-status.test.ts
preview-plugin-validation-matrix.md
```

---

## 10. GitHub Pages 首次设置

第一次部署需要在 GitHub 页面手动开启 Pages：

```txt
Repository → Settings → Pages → Build and deployment → Source → GitHub Actions
```

之后每次 push 到 `main` 自动部署，访问地址：

```txt
https://coderlambert.github.io/filevista/
```

---

## 11. 查看 CI 和部署结果

### 方式 1：GitHub 页面

```txt
GitHub → Actions → 选择 workflow → 点击具体 run 查看日志
```

### 方式 2：GitHub CLI

```bash
gh run list
gh run view <run-id> --log
```

### 方式 3：PR / Commit 页面

commit 和 PR 页面会显示绿色 ✅、红色 ❌ 或黄色 进行中状态。

---

## 12. 验收标准

16 阶段完成后，需要满足：

```txt
1. GitHub Actions CI 能在 push / pull_request 时自动运行
2. CI 包含 lint / test / build（standalone）
3. GitHub Pages 部署在 push 到 main 时自动触发
4. 本地存在统一验证命令 bun run check 和 bun run build:pages
5. Bun 版本在 CI 中固定
6. 静态资源路径自动适配 basePath
7. 文档说明本地验证和 CI 验证流程
```
