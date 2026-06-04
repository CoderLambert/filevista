# Stage 17 Release Docs — 开发日志

## 概述

Stage 17 将 FileVista 从"功能开发完成"推进到"可展示、可验证、可维护"的公开项目状态。本阶段不碰核心预览逻辑，只涉及文档体系、README、首页轻量入口和发布验证清单。

## 涉及提交

| Commit | 说明 |
|---|---|
| `9f69e3c` | 主提交：README 升级 + 4 份新文档 + 首页入口 + 验证矩阵 |
| `735227e` | 修正：Demo 文案与发布态支持矩阵对齐 |
| `e1d9b31` | 修正：README Features 中去掉"远程 URL"过度承诺 |

## 涉及文件

### 新增

```txt
docs/stage-17-release-experience-prd.md      # 本阶段 PRD
docs/user-facing-preview-support.md          # 用户版支持矩阵
docs/plugin-development-guide.md             # Plugin 开发指南
docs/github-pages-release-checklist.md       # GitHub Pages 发布检查清单
```

### 修改

```txt
README.md                                    # 升级为项目主页
src/app/page.tsx                             # 首页轻量增强
docs/preview-plugin-validation-matrix.md     # 追加 Stage 17 章节
src/components/file-preview/demos.ts         # Demo 内置 README 文案修正
```

## 关键决策记录

### 1. Stage 17 边界

明确本阶段**不做**：
- 不新增文件类型
- 不重构 Plugin Registry
- 不重构 Preview 组件内部解析逻辑
- 不引入新的大型依赖
- 不改 CI 主流程
- 不改 GitHub Pages 部署架构

### 2. Office 支持承诺降级

之前 README 和 Demo 中的过度承诺：
```txt
High-fidelity rendering
Full fidelity with styles, merges & images
```

降级为：
```txt
Browser-side preview
Best-effort browser-side preview for .docx
Browser-side preview for modern .xlsx files
```

同时在 README 明确：
- `.doc` 仅降级支持
- `.ppt` / `.xls` 不支持
- 大文件受浏览器性能限制
- 不承诺完整还原 Office 排版

### 3. 远程 URL 表达收敛

README Features 中原有：
```txt
支持本地 File / Blob / ArrayBuffer / 远程 URL
```

改为：
```txt
预览内核支持 File / Blob / ArrayBuffer 等数据源，当前公开 Demo 以本地文件上传与预览为主。
```

原因：首页当时没有远程 URL 输入入口，原描述容易让用户误解可以直接填远程文件 URL。

### 4. Demo 内置 README 一致性

`demos.ts` 中的内置 `README.md` 仍然把 `.ppt` 写在支持列表中，与 `support-status.ts` 矛盾。修正后：
```txt
Word              .docx   Modern Word browser-side preview
Legacy Word       .doc    Limited / degraded support
PowerPoint        .pptx   Modern PowerPoint browser-side preview
Legacy PowerPoint .ppt    Unsupported, convert to .pptx
Excel             .xlsx   Modern Excel browser-side preview
Legacy Excel      .xls    Unsupported, convert to .xlsx
```

### 5. Plugin 开发指南补 default export

新增说明：`PreviewPlugin.load()` 要求返回 `Promise<{ default: ComponentType<{ file: FileInfo }> }>`，因此 Adapter 必须默认导出组件。

## 验收结果

- `bun run check` 全部通过（lint + 34 tests + build）
- `bun run build:pages` 通过
- GitHub Actions CI 通过
- GitHub Pages Deploy 通过
