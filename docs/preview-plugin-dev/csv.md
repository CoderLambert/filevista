已整理成一份可直接放进项目的 Markdown 文档：

[下载 `filevista-csv-preview.md`](sandbox:/mnt/data/filevista-csv-preview.md)

建议放到你的项目中：

```bash
mkdir -p docs/preview
cp filevista-csv-preview.md docs/preview/csv-preview.md
```

我没有直接写入 GitHub 仓库，因为工具能在安装列表里确认到 `CoderLambert/filevista`，且描述确实是 FileVista 文件预览工具集；但读取文件时返回了 `vue-skills` 的 README 内容，存在误写仓库风险。

这份文档的核心结论是：**默认用 `Papa Parse + Web Worker + TanStack Table + TanStack Virtual`，高级模式再懒加载 `DuckDB-WASM`**。Papa Parse 官方支持浏览器本地文件解析、流式解析和 Worker；TanStack Virtual 是 headless 虚拟列表方案，适合保持 FileVista 自己的 UI 风格；DuckDB-WASM 可作为浏览器内本地 SQL 分析引擎，但不适合作为默认预览路径。([papaparse.com][1]) ([tanstack.com][2]) ([tanstack.com][3]) ([DuckDB][4])

可以在 README 或文档索引里加这一段：

## CSV 预览方案

CSV 预览模块采用纯前端方案实现，无服务端依赖。默认技术路线为：

```txt
Papa Parse + Web Worker + TanStack Table + TanStack Virtual
```

该方案将 CSV 预览拆分为解析层、数据模型层和渲染层：

- 解析层使用 Papa Parse，支持本地 File / Blob、分块解析、表头识别、分隔符识别和错误报告。
- 大文件解析放入 Web Worker，避免阻塞主线程。
- 渲染层使用 TanStack Table 和 TanStack Virtual，实现 Headless 表格和虚拟滚动。
- 高级分析模式可选接入 DuckDB-WASM，用于本地 SQL 查询、筛选、聚合和分页分析。
- AG Grid 和 Handsontable 不进入默认 bundle，只作为后续可选 renderer adapter。

详细设计见：

```txt
docs/preview/csv-preview.md
```

你可以这样提交：

```bash
git checkout -b docs/csv-preview-design

mkdir -p docs/preview
cp /path/to/filevista-csv-preview.md docs/preview/csv-preview.md

git add docs/preview/csv-preview.md
git commit -m "docs: add csv preview design"
git push origin docs/csv-preview-design
```

[1]: https://www.papaparse.com/ "Papa Parse - Powerful CSV Parser for JavaScript"
[2]: https://tanstack.com/virtual/latest "TanStack Virtual"
[3]: https://tanstack.com/table/latest/docs/guide/virtualization "Virtualization Guide | TanStack Table Docs"
[4]: https://duckdb.org/docs/current/clients/wasm/overview.html "DuckDB Wasm – DuckDB"
