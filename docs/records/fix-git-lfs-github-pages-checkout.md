# fix: enable Git LFS checkout in GitHub Pages workflow

## 改动背景

GitHub Pages 部署后 XLSX 等二进制 Demo 文件无法预览，JSZip 报错 `Can't find end of central directory: is this a zip file?`。原因是 `.gitattributes` 将 `xlsx/pptx/docx/pdf/epub` 等文件交由 Git LFS 管理，但 `actions/checkout@v4` 默认不下载 LFS 对象（`lfs: false`），导致部署到 Pages 的是 LFS 指针文本而非真实二进制文件。浏览器请求返回 200 OK，内容却是 `version https://git-lfs.github.com/spec/v1` 开头的指针，ExcelJS/JSZip 无法解压。

## 改动方案

- **CI 层面**：在 `pages.yml` 的 checkout 步骤添加 `lfs: true`，确保 LFS 对象被正确下载
- **CI 校验**：新增 `Verify Git LFS demo assets` 步骤，扫描 `apps/playground/public/demo/` 检查是否仍有 LFS 指针残留，有则报错退出
- **前端防护**：在 `fetchBinaryDemoFiles()` 中读取 Blob 前 256 字节，检测 LFS 指针特征字符串，命中时跳过该文件并 warn
- **错误处理**：`FileReader` 增加 reject 路径（空 base64 或读取失败），`catch` 改为 `console.error` 携带 error 对象

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `.github/workflows/pages.yml` | 修改 — LFS checkout + 校验步骤 |
| `apps/playground/src/lib/demos.ts` | 修改 — LFS 指针检测 + 错误处理增强 |

## 验证结果

- `tsc --noEmit` — 通过
- `eslint .` — 通过
