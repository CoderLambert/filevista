# FileVista Stage 17：发布态体验与文档完善

## 1. 阶段背景

FileVista 已经完成以下阶段：

```txt
Stage 14：Plugin Renderer 收口治理
Stage 15：Vitest 测试 + 组件交互测试 + 大文件体验兜底
Stage 16：CI 自动验证 + GitHub Pages 自动部署
```

Stage 17 的目标不是继续扩展预览能力，而是把项目从"开发可用"推进到"可展示、可验证、可维护"的公开项目状态。

## 2. 阶段目标

```txt
1. README 升级为项目主页
2. 首页补充发布态入口
3. 新增用户版支持矩阵
4. 新增 Plugin 开发指南
5. 新增 GitHub Pages 发布检查清单
6. 更新 Plugin Renderer 验证矩阵
7. 保持核心预览架构、CI、Pages 部署流程稳定
```

## 3. 本阶段边界

### 本阶段要做

```txt
更新 README
新增发布态文档
新增用户版支持矩阵
新增开发者扩展指南
新增 GitHub Pages 验证清单
首页增加 GitHub / Docs / Support Matrix 入口
```

### 本阶段不做

```txt
不继续新增文件类型
不重构 Plugin Registry
不重构 Preview 组件内部解析逻辑
不引入新的大型依赖
不改动 CI 主流程
不改动 GitHub Pages 部署架构
```

## 4. 改动文件

### 新增文件

```txt
docs/stage-17-release-experience-prd.md
docs/user-facing-preview-support.md
docs/plugin-development-guide.md
docs/github-pages-release-checklist.md
```

### 修改文件

```txt
README.md
src/app/page.tsx
docs/preview-plugin-validation-matrix.md
```

### 暂时不建议改

```txt
src/components/file-preview/utils.ts
src/components/file-preview/support-status.ts
src/components/file-preview/plugins/*
src/components/file-preview/preview-adapters/*
.github/workflows/ci.yml
.github/workflows/pages.yml
next.config.ts
package.json
```

## 5. 推荐实施顺序

### Step 1：新增文档

```bash
touch docs/stage-17-release-experience-prd.md
touch docs/user-facing-preview-support.md
touch docs/plugin-development-guide.md
touch docs/github-pages-release-checklist.md
```

### Step 2：更新 README

重点加入在线 Demo 地址、特性、支持类型、开发命令、CI 说明、当前限制。

### Step 3：轻量更新首页

- Header 增加 GitHub / Docs / Support Matrix 链接
- 标题下方补充 No upload / No server processing 文案
- 支持格式文案更精确（区分 Modern Office / Legacy Office）

### Step 4：同步 validation matrix

追加 Stage 17 说明章节。

### Step 5：验证

```bash
bun run check
bun run build:pages
```

### Step 6：提交

```bash
git add README.md src/app/page.tsx docs/
git commit -m "docs: polish release experience and plugin documentation"
git push
```

## 6. 验收标准

```txt
1. README 能清楚说明 FileVista 是什么
2. README 包含在线 Demo 地址
3. README 包含本地开发、测试、构建、Pages 构建命令
4. README 明确旧版 Office 和大文件限制
5. 首页有 GitHub / Docs / Support Matrix 入口
6. 首页没有误导性支持描述
7. docs/user-facing-preview-support.md 已建立
8. docs/plugin-development-guide.md 已建立
9. docs/github-pages-release-checklist.md 已建立
10. docs/stage-17-release-experience-prd.md 已建立
11. docs/preview-plugin-validation-matrix.md 追加 Stage 17 说明
12. bun run check 通过
13. bun run build:pages 通过
14. GitHub Actions CI 通过
15. GitHub Pages Deploy 通过
16. https://coderlambert.github.io/filevista/ 可访问
17. Demo Files 在 Pages 环境能加载
18. PDF worker 在 Pages 环境不出现 404
```

## 7. 风险与注意点

- README 不要过度承诺（不支持"所有 Office"、"任意大文件"、"所有浏览器"）
- support-status.ts 改动后必须同步 README、用户版支持矩阵、验证矩阵
- 站内资源路径必须使用 NEXT_PUBLIC_BASE_PATH，不要写死根路径

## 8. 阶段完成后的项目状态

```txt
1. 可公开访问的在线 Demo
2. 自动化 CI 验证
3. 自动化 GitHub Pages 部署
4. 插件化文件预览架构
5. 明确的文件类型支持矩阵
6. 可执行的新增 Plugin 流程
7. 可执行的发布后验证清单
```

## 9. 下一阶段建议

Stage 17 完成后，建议进入：

```txt
Stage 18：预览性能与大文件处理优化
```

候选方向：

```txt
1. 大文件读取进度提示
2. 二进制文件懒读取策略
3. PDF / Office 渲染取消机制完善
4. Worker 化部分重解析任务
5. 文件预览错误边界统一
6. Plugin 加载失败 fallback
```
