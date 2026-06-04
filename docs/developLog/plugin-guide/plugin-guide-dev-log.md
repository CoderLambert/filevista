# Plugin Development Guide — 开发日志

## 概述

`docs/plugin-development-guide.md` 是新增文件，用于指导后续新增文件类型时的标准流程，不再依赖记忆。

## 涉及提交

| Commit | 说明 |
|---|---|
| `9f69e3c` | 初始创建 |
| `735227e` | 补充 Adapter export default 说明 |

## 文件结构

文档包含 9 个步骤：

1. **Add FileType** — `utils.ts` 中添加类型定义
2. **Update detectFileType** — 扩展名/MIME 识别逻辑
3. **Create Plugin** — `plugins/<type>-plugin.ts`
4. **Create Adapter** — `preview-adapters/<Type>PreviewAdapter.tsx`
5. **Register Plugin** — `builtin-plugins.ts` 中注册
6. **Update Support Matrix** — `support-status.ts` 中新增条目
7. **Update Tests** — 运行 `bun run test:run`
8. **Update Docs** — 同步 README、用户支持矩阵、验证矩阵
9. **Final Verification** — `bun run check` + `bun run build:pages`

## 关键修正：export default 补充

`PreviewPlugin.load()` 的返回类型要求：
```ts
Promise<{ default: ComponentType<{ file: FileInfo }> }>
```

因此 Adapter 文件必须默认导出：
```ts
export default function ExamplePreviewAdapter({ file }: { file: FileInfo }) {
  // ...
}
```

初始版本遗漏了这一点，在第一次审查后补上。

## Adapter 行为规范

```txt
1. 只检查必要输入
2. 桥接 FileInfo 到已有 Preview 组件 props
3. 输入缺失时返回 UnsupportedPluginPreview
4. 不在 adapter 内部重复解析文件
5. 不直接引入大型解析库
6. 不修改 file.content / file.source / file.url
```
