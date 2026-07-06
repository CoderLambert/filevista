"use client";

/**
 * Demo: 在其他业务项目中使用 largeFilePolicy 控制最大文件预览大小。
 *
 * 这是提供给外部业务项目的参考示例，展示了所有 `largeFilePolicy` 的用法。
 * 文件路径: apps/playground/src/app/large-file-policy-demo.tsx
 *
 * 在浏览器访问: http://localhost:3000 后临时替换渲染组件即可看到效果。
 */

import { useState, useCallback } from "react";
import type { FileInfo, LargeFilePolicy, PreviewSizePolicyConfig } from "@lamberl-lee/file-preview";
import { PluginPreviewRenderer } from "@lamberl-lee/file-preview";
import type { PreviewPluginRegistry } from "@lamberl-lee/file-preview";

const MB = 1024 * 1024;

// ─── 示例 1: 定义项目级别的预览大小策略 ─────────────────────────────────
//
// 使用 `satisfies PreviewSizePolicyConfig` 可以在写配置时获得自动补全
// 和类型检查，避免误写错属性名。
const PREVIEW_SIZE_POLICY = {
  maxBytes: 10 * MB,
} satisfies PreviewSizePolicyConfig;

// ─── 示例 2: 分级策略（可选 warning + confirm） ─────────────────────────
const TIERED_POLICY = {
  warningBytes: 20 * MB,
  confirmBytes: 35 * MB,
  maxBytes: 50 * MB,
} satisfies PreviewSizePolicyConfig;

// ─── 示例 3: 完全关闭限制 ──────────────────────────────────────────────
const NO_LIMIT_POLICY = "off" as const;

// ─── 示例 4: 使用默认策略（20 / 50 / 100 MB） ──────────────────────────
const DEFAULT_POLICY = "default" as const;

// ==========================================================================
// 组件: LargeFilePolicyDemo
// ==========================================================================
//
// 展示如何在业务组件中使用 PluginPreviewRenderer 的 largeFilePolicy，
// 以及如何搭配 processRemoteUrl 的 maxBytes 做双层防护。

interface LargeFilePolicyDemoProps {
  file: FileInfo;
  registry: PreviewPluginRegistry;
  /** 切换不同策略进行测试 */
  policy?: "default" | "off" | "custom" | "tiered";
}

export function LargeFilePolicyDemo({
  file,
  registry,
  policy = "custom",
}: LargeFilePolicyDemoProps) {
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const handleError = useCallback(
    (error: { code: string; message: string; details?: Record<string, unknown> }) => {
      setErrorLog((prev) => [
        `[${new Date().toISOString()}] ${error.code}: ${error.message}`,
        ...prev.slice(0, 9),
      ]);

      // ─── 真实业务场景：统一错误上报 ──────────────────────────────────
      if (error.code === "FILE_TOO_LARGE") {
        // 这里对接你们自己的埋点/监控系统
        // reportTelemetry({
        //   event: "file_preview_blocked",
        //   fileName: file.name,
        //   ...error.details,
        // });
        console.log("[业务] 文件过大被拦截", error.details);
      }

      if (error.code === "UNSUPPORTED_FILE_TYPE") {
        console.log("[业务] 不支持的文件类型", error.details);
      }
    },
    [],
  );

  // ─── 根据传入的 policy 名称选择对应配置 ────────────────────────────
  const resolvedPolicy = (() => {
    switch (policy) {
      case "off":
        return NO_LIMIT_POLICY;
      case "custom":
        return PREVIEW_SIZE_POLICY;
      case "tiered":
        return TIERED_POLICY;
      default:
        return DEFAULT_POLICY;
    }
  })();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      {/* ── 当前策略标签 ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "#333" }}>当前策略:</span>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: 4,
            background: policy === "off" ? "#eee" : policy === "tiered" ? "#e8f5e9" : "#e3f2fd",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {formatPolicyLabel(resolvedPolicy)}
        </span>
      </div>

      {/* ── 错误日志（展示 onError 回调收到的错误） ──────────────────── */}
      {errorLog.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fff3e0",
            borderRadius: 6,
            border: "1px solid #ffe0b2",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>onError 回调日志:</div>
          {errorLog.map((log, i) => (
            <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#e65100" }}>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* ── 预览区域 ──────────────────────────────────────────────────── */}
      <div
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          minHeight: 400,
          overflow: "hidden",
        }}
      >
        <PluginPreviewRenderer
          file={file}
          registry={registry}
          largeFilePolicy={resolvedPolicy}
          onError={handleError}
          renderLargeFileFallback={({ file, maxBytes, download }) => (
            // ─── 自定义超限降级页面（可选） ─────────────────────────────
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 400,
                gap: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 48 }}>📁</div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#333" }}>
                {file.name} 超出预览限制
              </h2>
              <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
                文件大小 {formatDisplaySize(file.size)}，超过最大预览限制{" "}
                {formatDisplaySize(maxBytes)}，请下载后查看。
              </p>
              <button
                onClick={() => download().catch((e) => console.error(e))}
                style={{
                  padding: "8px 24px",
                  borderRadius: 6,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                下载文件
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function formatDisplaySize(bytes: number): string {
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * 从 policy 对象派生展示文案，避免常量与 UI 标签脱钩。
 *
 * `LargeFilePolicy` 是联合类型（`"default" | "off" | PreviewSizePolicyConfig`），
 * 三种情况都要覆盖。
 */
function formatPolicyLabel(policy: LargeFilePolicy): string {
  if (policy === "default") return 'largeFilePolicy="default"';
  if (policy === "off") return 'largeFilePolicy="off"';

  const parts: string[] = [];
  if (policy.warningBytes != null) {
    parts.push(`warningBytes:${formatDisplaySize(policy.warningBytes)}`);
  }
  if (policy.confirmBytes != null) {
    parts.push(`confirmBytes:${formatDisplaySize(policy.confirmBytes)}`);
  }
  parts.push(`maxBytes:${formatDisplaySize(policy.maxBytes)}`);
  return `largeFilePolicy={{ ${parts.join(", ")} }}`;
}

// ==========================================================================
// 远程 URL 预览 + 双层大小限制（推荐模式）
// ==========================================================================

/**
 * 当预览远程 URL 时，建议同时配置两层限制：
 *
 * 1. processRemoteUrl 的 maxBytes —— 在下载阶段拦截超大文件，节省带宽
 * 2. PluginPreviewRenderer 的 largeFilePolicy —— 渲染阶段拦截
 *
 * 这样即使 processRemoteUrl 绕过（比如本地 File 对象），渲染时也能拦截。
 */

// import { processRemoteUrl, RemoteUrlError } from "@lamberl-lee/file-preview";
//
// export async function loadRemoteFile(url: string) {
//   const file = await processRemoteUrl(url, {
//     maxBytes: PREVIEW_SIZE_POLICY.maxBytes, // ← 下载阶段 50 MB 硬限制
//     onProgress: (p) => console.log(`${p.percent}%`),
//   });
//
//   return file;
// }
//
// // 使用：
// // const file = await loadRemoteFile("https://example.com/large-report.pdf");
// // return (
// //   <PluginPreviewRenderer
// //     file={file}
// //     registry={registry}
// //     largeFilePolicy={PREVIEW_SIZE_POLICY} // ← 渲染阶段同样限制
// //     onError={handleError}
// //   />
// // );

// ==========================================================================
// 总结：对外暴露的类型可以直接 import
// ==========================================================================

// import type {
//   PreviewSizePolicyConfig,  // 自定义策略的类型
//   LargeFilePolicy,          // largeFilePolicy prop 的联合类型
//   LargeFileBlockedContext,  // renderLargeFileFallback 的上下文类型
// } from "@lamberl-lee/file-preview";
