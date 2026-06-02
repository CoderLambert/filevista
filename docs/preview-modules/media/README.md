# 媒体预览模块

## VideoPreview

**文件路径**：`src/components/file-preview/VideoPreview.tsx`

**文件类型**：MP4, WebM, OGG, MOV, AVI

### 渲染方案
- 使用 HTML5 `<video>` 标签原生播放
- `URL.createObjectURL(file)` 创建 Object URL

### 核心特性
| 特性 | 实现方式 |
|------|---------|
| 播放/暂停 | 原生 video controls |
| 进度条 | 原生 controls |
| 全屏 | 原生 controls |
| 音量控制 | 原生 controls |
| 倍速 | 原生 playbackRate |

### 支持的编解码器
- H.264 (MP4) — 浏览器兼容性最好
- VP8/VP9 (WebM) — Chrome/Firefox 原生支持
- AV1 — 部分新浏览器支持

---

## AudioPreview

**文件路径**：`src/components/file-preview/AudioPreview.tsx`

**文件类型**：MP3, WAV, OGG, FLAC, AAC, M4A

### 渲染方案
- 使用 HTML5 `<audio>` 标签原生播放
- `URL.createObjectURL(file)` 创建 Object URL

### 核心特性
| 特性 | 实现方式 |
|------|---------|
| 播放/暂停 | 原生 audio controls |
| 进度条 | 原生 controls |
| 音量控制 | 原生 controls |
| 波形 | 不支持（仅控制栏） |

### 内存管理
- 视频/音频文件通过 Object URL 引用
- 组件卸载或文件移除时 `URL.revokeObjectURL()` 释放内存
