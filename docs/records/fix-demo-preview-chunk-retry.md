# 修复 demo 预览插件分块失败后无法重试

## 问题与证据

用户截图中，demo 图片已出现在文件列表，但预览区域显示“预览加载失败”。本次访问线上 Pages 时，图片可以正常加载，无法从截图事后确定首次分块请求失败的原因。

通过拦截图片插件的 JS 分块，可以稳定复现同样的错误界面。随后解除网络拦截并点击 Retry，仍然抛出同一个 `ChunkLoadError`，且不再请求该分块。在线上的 Turbopack 构建与本地未修改的 Pages 导出中均复现了这个恢复失败的问题。

`PluginPreviewRenderer` 已在 Retry 时清除自己的 promise 缓存，但 Turbopack 运行时仍缓存失败的分块加载结果，重新调用 `plugin.load()` 无法恢复。demo 图片数据和 `/filevista` 资源前缀不是这次复现中的失败原因。

## 修改

Playground 的生产构建与 Pages 构建显式使用 `next build --webpack`。同样的网络失败恢复场景下，Webpack 会重新请求失败的分块，现有 Retry 按钮因此能够恢复预览，同时保留用户已加载的文件。

使用官方支持的构建选项，避免依赖或修改 Turbopack 的私有运行时缓存。没有通过刷新页面恢复，以免丢失内存中的本地文件。

新增针对真实 Pages 导出产物的 Playwright 测试，并在 Pages 上传发布产物前执行：

- 点击 Demo Files，经生成清单、真实 demo 加载函数和插件渲染路径，断言图片已解码显示。
- 阻断插件分块，断言出现加载失败提示；解除阻断并点击 Retry，断言产生新的 JS 请求、图片正常显示、页面没有导航、文件列表仍被保留。

测试仅替换 demo 文件 HTTP 响应，提供一个固定有效 PNG，并让其他 demo 请求返回 404；不依赖 Git LFS 下载和外网。Next 分块、组件库、文件解码与渲染均使用构建产物。此测试不验证其他 Office/媒体示例的文件内容。

## 本地验证

```bash
pnpm install --frozen-lockfile
pnpm run build:lib
pnpm --filter @lamberl-lee/playground run build:pages
pnpm --filter @lamberl-lee/playground exec playwright install chromium
pnpm --filter @lamberl-lee/playground run test:pages
pnpm run lint
pnpm -r run typecheck
pnpm run test
pnpm --filter @lamberl-lee/playground run build
```

- 修复前：正常预览通过，Retry 恢复测试失败，恢复网络后找不到图片。
- 修复后：两个浏览器回归测试全部通过。
- 组件库：16 个测试文件、162 个测试全部通过。
- lint、两个工作区的类型检查、Pages 静态构建、standalone 生产构建均通过。
- agent-browser 实际图片验收：在本地 Pages 导出中拦截图片插件分块，解除拦截后 Retry 成功，图片尺寸为 1856 × 1120，文件列表保留。

本次修改已在本地验证，线上仍需发布新构建才能生效。持续不可用或已被删除的服务器资源仍需恢复资源本身。
