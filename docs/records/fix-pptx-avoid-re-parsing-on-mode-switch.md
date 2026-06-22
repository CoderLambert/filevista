# fix(pptx): avoid re-parsing on mode switch, fix double render, and improve abort handling

## 改动背景

本次 PPTX 预览重构（引入 `@aiden0z/pptx-renderer` 引擎）提交后，代码审查发现了几个关键问题：

1. **模式切换重新解析整个 PPTX**：主初始化 Effect 依赖了 `viewMode`，导致点击 Grid/Slide 按钮时 React 重新执行整个 mount，重新读取文件、解压 ZIP、创建 Viewer。
2. **首次加载重复渲染**：模式切换 Effect 依赖 `state.status`，初始化完成后 `loading → ready` 状态转换额外触发一次 `renderSlide()`，导致同一页连续渲染两次。
3. **键盘处理器捕获旧状态**：`handleKeyDown` 的 `useCallback` 依赖缺失 `isModeSwitching`，切换期间方向键仍可能触发翻页。
4. **Abort 检查不完整**：`parsePptxZip()` 在 `doParse()` 完成后未检查 AbortSignal；fallback 函数不支持 Signal，长 PPTX 降级解析中无法及时退出。
5. **缩放值传递不一致**：`initialZoom` 归一化后用于 React state，但原始值仍被传入 `openPptxViewer`，可能导致底层与 UI 状态不一致。

## 改动方案

### 1. 主初始化 Effect 仅依赖 `source`

```tsx
const viewModeRef = useRef<PptxViewMode>(viewMode);
useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

// 初始化 Effect 只依赖 source，通过 ref 读取当前模式
useEffect(() => {
  const startViewMode = viewModeRef.current;
  // ... mount viewer
}, [source]);
```

`initialZoom` 属性变化通过独立的 Effect 直接调用 `viewer.setZoom()`，不重建 Viewer。

### 2. 模式切换 Effect 移除 `state.status` 依赖

```tsx
useEffect(() => {
  const viewer = viewerRef.current;
  if (!viewer) return;  // 按钮已禁用，避免了非 ready 触发
  // ... renderList / renderSlide
}, [viewMode]);
```

### 3. `handleKeyDown` 补全依赖

```tsx
[viewMode, state.status, isModeSwitching, prevSlide, nextSlide]
```

### 4. 完善 AbortSignal 检查

- `parsePptxZip()`：`doParse()` 完成后 `signal?.throwIfAborted()`
- `readPptxInsight()` / `readPptxSemanticDeck()`：接收可选的 `AbortSignal`，每页处理前检查

### 5. 缩放边界归一化

```tsx
const zoomMin = Math.min(minZoom, maxZoom);
const zoomMax = Math.max(minZoom, maxZoom);
```

`zoomOut`/`zoomIn` 使用归一化边界；开发环境输出 `console.warn` 提示 min/max 颠倒。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `packages/file-preview/src/PptxPreview.tsx` | 重构 Effect 依赖关系、zoom 归一化、补充依赖 |
| `packages/file-preview/src/engines/pptx/pptx-renderer-engine.ts` | 新增 `parsePptxZip` 完成后的 abort 检查 |
| `packages/file-preview/src/pptx/read-pptx-insight.ts` | 新增可选 `AbortSignal` 参数、每页循环检查 |
| `packages/file-preview/src/pptx/read-pptx-semantic-deck.ts` | 新增可选 `AbortSignal` 参数、每页循环检查 |

## 验证结果

```text
✓ TypeScript typecheck 通过
✓ Vitest 115 项测试全部通过
✓ ESLint lint 通过
```