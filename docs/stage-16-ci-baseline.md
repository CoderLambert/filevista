# Stage 16: CI Baseline

## 1. 目标

16 阶段用于建立 FileVista 的基础工程验证流程。

本阶段目标不是继续扩展文件预览能力，而是保证每次提交至少经过以下验证：

```txt
lint
unit/component tests
production build
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
bun run build
```

---

## 4. GitHub Actions CI

CI 文件位置：

```txt
.github/workflows/ci.yml
```

触发条件：

```txt
push 到 main/dev
pull_request 到 main/dev
```

CI 执行步骤：

```txt
1. checkout repository
2. setup Bun
3. bun install --frozen-lockfile
4. bun run lint
5. bun run test:run
6. bun run build
```

---

## 5. Bun 版本

项目使用 `.bun-version` 固定 CI 中的 Bun 版本，避免 `latest` 造成不可预期变化。

查看当前版本：

```bash
cat .bun-version
```

如需升级 Bun：

```bash
bun --version
```

确认本地通过后再更新 `.bun-version`。

---

## 6. TypeScript 类型检查

当前项目保留：

```bash
bun run typecheck
```

但暂不接入 CI 阻塞流程。

原因：

```txt
next.config.ts 当前设置了 ignoreBuildErrors: true
直接把 typecheck 接入 CI 可能会引入历史类型债清理范围
```

后续可以单独开阶段处理：

```txt
Stage 17: TypeScript strictness and build error cleanup
```

---

## 7. 新增文件类型后的验证流程

新增文件类型后，需要执行：

```bash
bun run test:run
bun run build
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

## 8. 验收标准

16 阶段完成后，需要满足：

```txt
1. GitHub Actions CI 能在 push / pull_request 时自动运行
2. CI 包含 lint / test / build
3. 本地存在统一验证命令 bun run check
4. Bun 版本在 CI 中固定
5. 文档说明本地验证和 CI 验证流程
```
