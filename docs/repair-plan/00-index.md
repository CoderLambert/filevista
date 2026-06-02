# FileVista 修复计划总览

## 目标

将 FileVista 从当前的多格式预览 Demo 应用，逐步修复为稳定、安全、可扩展的浏览器端文件预览工具集。

## 当前阶段

当前项目已经具备：

- 多文件选择
- 拖拽上传
- 文件类型识别
- 多格式预览
- TabCache 预览缓存
- PDF / DOCX / PPTX / XLSX / Code / Markdown / HTML / SVG 等预览组件
- 按格式懒加载预览器
- 预览插件注册表（Preview Plugin Registry）

## 优先级说明

| 优先级 | 说明 |
|---|---|
| P0 | 必须先修，影响正确性、安全性、稳定性 |
| P1 | 性能优化，主要解决大文件卡顿 |
| P2 | 架构升级，为插件化和 SDK 化做准备 |
| P3 | 工程质量、测试、文档完善 |

## 推荐执行顺序

1. `01-p0-project-docs.md`
2. `02-p0-file-type-detection.md`
3. `03-p0-pdf-worker-and-cleanup.md`
4. `04-p0-preview-security.md`
5. `05-p0-resource-cleanup.md`
6. `06-p1-large-file-fallback.md`
7. `07-p1-xlsx-fast-mode.md`
8. `08-p2-preview-source-abstraction.md`
9. `09-p2-plugin-architecture.md`
10. `10-p3-engineering-quality-and-tests.md`

## 推荐提交粒度

每个文档对应一个或多个 commit，不建议一次性大改。

示例：

```bash
git commit -m "docs: add FileVista project README"
git commit -m "fix: improve file type detection"
git commit -m "fix: use local PDF.js worker"
git commit -m "fix: harden preview sandbox"
git commit -m "feat: add large file fallback"
```

## 建议执行批次

```
第一批：P0 正确性  →  01, 02
第二批：P0 稳定性  →  03, 05
第三批：P0 安全性  →  04
第四批：P1 性能    →  06, 07
第五批：P2 架构    →  08, 09
第六批：P3 工程    →  10
```
