# Stage 17 Demo Content — 开发日志

## 概述

修正 `src/components/file-preview/demos.ts` 中内置 README 的过度承诺文案，使其与 `support-status.ts` 和 README 保持一致。

## 涉及提交

| Commit | 说明 |
|---|---|
| `735227e` | Demo 文案修正 + README 远程 URL 收敛 |

## 改动内容

### 1. Office 支持表格拆分

原来：
```txt
Word     .docx           High-fidelity rendering with docx-preview
PPT      .pptx, .ppt     Slide parsing with navigation
Excel    .xlsx           Full fidelity with styles, merges & images
```

改为：
```txt
Word              .docx   Modern Word browser-side preview
Legacy Word       .doc    Limited / degraded support
PowerPoint        .pptx   Modern PowerPoint browser-side preview
Legacy PowerPoint .ppt    Unsupported, convert to .pptx
Excel             .xlsx   Modern Excel browser-side preview
Legacy Excel      .xls    Unsupported, convert to .xlsx
```

关键变化：
- `.doc` 从支持列表中拆出，标注为 Limited/degraded
- `.ppt` 从支持列表中移除，标注为 Unsupported
- `.xls` 新增，标注为 Unsupported

### 2. Features 文案降级

原来：
```txt
Excel preview — Full fidelity with styles, merged cells & images
Word docs — High-fidelity rendering with docx-preview
```

改为：
```txt
Excel preview — Browser-side preview for modern .xlsx files
Word docs — Best-effort browser-side preview for .docx
```

### 3. 风险

不修正会导致：
- 用户通过 Demo README 看到的支持范围与实际能力不一致
- 发布态页面出现过度承诺
- 与 README 中"不承诺完整还原所有 Office 排版效果"自相矛盾
