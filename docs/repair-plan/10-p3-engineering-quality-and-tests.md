# P3 - 工程质量与测试矩阵

## 背景

当前项目中存在一些工程配置风险：

- TypeScript 构建错误被忽略
- React StrictMode 被关闭
- `noImplicitAny` 被关闭
- 多格式预览缺少测试矩阵

## 涉及文件

```txt
next.config.ts
tsconfig.json
package.json
docs/repair-plan/test-matrix.md
```

## 任务 1：逐步关闭 ignoreBuildErrors

当前：

```ts
typescript: {
  ignoreBuildErrors: true,
}
```

目标：

```ts
typescript: {
  ignoreBuildErrors: false,
}
```

或者直接删除该配置。

## 任务 2：恢复 React StrictMode

当前：

```ts
reactStrictMode: false
```

目标：

```ts
reactStrictMode: true
```

注意：恢复之前，应先完成资源 cleanup 修复。

## 任务 3：逐步开启 noImplicitAny

当前：

```json
"strict": true,
"noImplicitAny": false
```

目标：

```json
"strict": true,
"noImplicitAny": true
```

第三方库对象不要全局放宽，应该局部定义最小接口。

## 任务 4：新增测试矩阵

新增：

```txt
docs/repair-plan/test-matrix.md
```

内容：

| 文件           | 预期                    |
| ------------ | --------------------- |
| test.pdf     | PDF 正常预览              |
| README.md    | Markdown 正常预览         |
| package.json | JSON 格式化              |
| example.ts   | TypeScript 高亮         |
| Dockerfile   | 识别为 code              |
| Makefile     | 识别为 code              |
| demo.docx    | DOCX 预览               |
| legacy.doc   | 文本提取                  |
| slides.pptx  | PPTX 预览               |
| legacy.ppt   | 明确提示不支持               |
| table.xlsx   | XLSX 预览               |
| legacy.xls   | 明确提示不支持               |
| index.html   | iframe 预览且 script 不执行 |
| icon.svg     | img 方式预览且 script 不执行  |
| archive.zip  | ZIP 预览                |
| book.epub    | EPUB 预览               |
| image.png    | 图片预览                  |
| video.mp4    | 视频播放                  |
| audio.mp3    | 音频播放                  |
| data.csv     | CSV 表格                |
| large.log    | 大文件降级                 |

## 任务 5：新增检查命令

建议在 `package.json` 中增加：

```json
{
  "scripts": {
    "check": "bun run lint && bun run build"
  }
}
```

## 验收标准

* `bun run lint` 通过
* `bun run build` 通过
* `bun run check` 通过
* 所有测试矩阵里的文件都有明确结果
