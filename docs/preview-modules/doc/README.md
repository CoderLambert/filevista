# DOC 预览模块

## 组件：DocPreview

**文件路径**：`src/components/file-preview/DocPreview.tsx`

**文件类型**：DOC (.doc) — 旧版 Word 二进制格式

**核心依赖**：`mammoth@1.12.0`

## 技术实现

### 渲染方案
- DOC 是旧版二进制格式，mammoth 不直接支持
- 通过 `FileReader.readAsArrayBuffer` 直接读取二进制
- 尝试 mammoth 解析，失败时提供友好错误提示

### 与 DOCX 的区别

| 方面 | DOCX | DOC |
|------|------|-----|
| 格式 | Office Open XML (ZIP) | OLE2 二进制 |
| mammoth 支持 | ✅ 完全支持 | ⚠️ 部分支持 |
| 输入方式 | base64 → ArrayBuffer | base64 → ArrayBuffer |
| 可靠性 | 高 | 中等，部分文件可能无法解析 |

### 降级策略
1. 尝试 mammoth 解析
2. 解析失败 → 显示 ".doc 格式建议转换为 .docx" 提示
3. 显示错误详情帮助用户理解问题
