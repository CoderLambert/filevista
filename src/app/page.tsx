"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Eye,
  Trash2,
  File,
  FolderOpen,
  Sparkles,
  Github,
  BookOpen,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileInfo,
  detectFileType,
  getFileTypeColor,
  getFileTypeLabel,
  formatFileSize,
  generateId,
  FileType,
  base64ToUint8Array,
} from "@/components/file-preview/utils";
import { PluginPreviewRenderer } from "@/components/file-preview/PluginPreviewRenderer";
import { LargeFileGate } from "@/components/file-preview/LargeFileGate";
import { DEMO_FILES, fetchBinaryDemoFiles } from "@/components/file-preview/demos";
import {
  processRemoteUrl,
  RemoteUrlError,
  type RemoteLoadProgress,
} from "@/components/file-preview/remote-url";

const FILE_TYPE_ICONS: Record<FileType, string> = {
  pdf: "📄",
  markdown: "📝",
  json: "🔧",
  code: "💻",
  docx: "📃",
  doc: "📃",
  pptx: "📊",
  ppt: "📊",
  xlsx: "📗",
  xls: "📗",
  html: "🌐",
  zip: "📦",
  svg: "🎨",
  rtf: "📃",
  epub: "📖",
  image: "🖼️",
  text: "📄",
  csv: "📊",
  video: "🎬",
  audio: "🎵",
  unknown: "📎",
};

const DEFAULT_REMOTE_URL =
  "https://501351981.github.io/vue-office/examples/dist/static/test-files/test.pptx";

export default function Home() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [remoteUrl, setRemoteUrl] = useState(DEFAULT_REMOTE_URL);
  const [loadingRemoteUrl, setLoadingRemoteUrl] = useState(false);
  const [remoteProgress, setRemoteProgress] = useState<RemoteLoadProgress | null>(null);
  const remoteAbortRef = useRef<AbortController | null>(null);
  const [previewConfirmedFileIds, setPreviewConfirmedFileIds] = useState<Set<string>>(
    () => new Set()
  );

  const activeFile = files.find((f) => f.id === activeFileId) || null;

  const processFile = useCallback(async (file: File): Promise<FileInfo> => {
    const fileType = detectFileType(file.name, file.type);

    return {
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      fileType,
      source: {
        kind: "file",
        file,
      },
    };
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: FileInfo[] = [];
      for (const file of Array.from(fileList)) {
        try {
          const info = await processFile(file);
          newFiles.push(info);
        } catch {
          toast.error(`Failed to read file: ${file.name}`);
        }
      }
      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        setActiveFileId(newFiles[0].id);
        toast.success(`Added ${newFiles.length} file(s)`);
      }
    },
    [processFile]
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== id);

        if (activeFileId === id) {
          setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
        }

        return remaining;
      });
    },
    [activeFileId]
  );

  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadDemoFiles = useCallback(async () => {
    setLoadingDemo(true);
    try {
      // Load text-based demos
      const textDemos: FileInfo[] = Object.entries(DEMO_FILES).map(([, demo]) => {
        const blob = new Blob([demo.content], { type: demo.type });

        return {
          id: generateId(),
          name: demo.name,
          size: blob.size,
          type: demo.type,
          fileType: detectFileType(demo.name, demo.type),
          source: {
            kind: "blob",
            blob,
            name: demo.name,
            mimeType: demo.type,
          },
        };
      });

      // Load binary demos (EPUB, XLSX, DOCX) from public directory
      const binaryDemos = await fetchBinaryDemoFiles();
      const binaryInfos: FileInfo[] = binaryDemos.map((demo) => {
        const bytes = base64ToUint8Array(demo.content);
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;

        return {
          id: generateId(),
          name: demo.name,
          size: demo.size,
          type: demo.type,
          fileType: detectFileType(demo.name, demo.type),
          source: {
            kind: "arrayBuffer",
            buffer,
            name: demo.name,
            mimeType: demo.type,
          },
        };
      });

      const allDemos = [...textDemos, ...binaryInfos];
      setFiles(allDemos);
      setActiveFileId(allDemos[0].id);
      toast.success(`Loaded ${allDemos.length} demo files!`);
    } catch (err) {
      console.error("Failed to load demo files:", err);
      toast.error("Failed to load demo files");
    } finally {
      setLoadingDemo(false);
    }
  }, []);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    setActiveFileId(null);
    toast.success("All files cleared");
  }, []);

  const loadRemoteUrl = useCallback(async () => {
    if (!remoteUrl.trim()) {
      toast.error("Remote URL is empty");
      return;
    }

    const currentUrl = remoteUrl.trim();
    const controller = new AbortController();

    remoteAbortRef.current = controller;
    setRemoteProgress(null);
    setLoadingRemoteUrl(true);

    try {
      const info = await processRemoteUrl(currentUrl, {
        signal: controller.signal,
        onProgress: setRemoteProgress,
      });

      setFiles((prev) => [...prev, info]);
      setActiveFileId(info.id);
      setRemoteUrl("");
      setRemoteProgress(null);

      toast.success(`Loaded remote file: ${info.name}`);

      if (["ppt", "xls"].includes(info.fileType)) {
        toast.warning(
          `${info.name} is a legacy Office format. Preview is not supported. Please convert to .pptx / .xlsx.`
        );
      }
    } catch (err) {
      if (err instanceof RemoteUrlError && err.code === "ABORTED") {
        toast.info(err.message);
        return;
      }

      const message =
        err instanceof Error ? err.message : "Failed to load remote URL";

      toast.error(message, {
        description: "你可以在新标签页打开原始链接下载。",
        action: {
          label: "Open",
          onClick: () => {
            window.open(currentUrl, "_blank", "noopener,noreferrer");
          },
        },
      });
    } finally {
      if (remoteAbortRef.current === controller) {
        remoteAbortRef.current = null;
      }

      setLoadingRemoteUrl(false);
      setRemoteProgress(null);
    }
  }, [remoteUrl]);

  const cancelRemoteLoad = useCallback(() => {
    remoteAbortRef.current?.abort();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex h-14 items-center px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Eye className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                FileVista
              </h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5 hidden sm:block">
                纯浏览器端文件预览 · 文件不上传
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/CoderLambert/filevista"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2"
            >
              <Github className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://github.com/CoderLambert/filevista/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </a>
            <a
              href="https://github.com/CoderLambert/filevista/blob/main/docs/user-facing-preview-support.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDemoFiles}
              disabled={loadingDemo}
              className="gap-1.5 text-xs h-8"
            >
              {loadingDemo ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Demo Files
            </Button>
            {files.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFiles}
                className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full">
        {/* Sidebar - File List */}
        <aside className="w-full lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r bg-muted/20">
          <div className="p-3 border-b space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2 h-10 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen className="h-4 w-4" />
              Select Files / 浏览文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
              accept="*"
            />
            <div className="flex gap-2">
              <input
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    loadRemoteUrl();
                  }
                }}
                placeholder="Paste remote file URL"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadingRemoteUrl ? cancelRemoteLoad : loadRemoteUrl}
                disabled={!loadingRemoteUrl && !remoteUrl.trim()}
                className="h-9 shrink-0 gap-1.5 text-xs"
              >
                {loadingRemoteUrl ? (
                  "Cancel"
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {loadingRemoteUrl ? "Cancel" : "URL"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!remoteUrl.trim()}
                onClick={() => {
                  window.open(remoteUrl, "_blank", "noopener,noreferrer");
                }}
                className="h-9 shrink-0 text-xs"
              >
                Open
              </Button>
            </div>

            {loadingRemoteUrl && remoteProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Loading remote file...</span>
                  <span>
                    {remoteProgress.total
                      ? `${formatFileSize(remoteProgress.received)} / ${formatFileSize(remoteProgress.total)} (${Math.round((remoteProgress.percent ?? 0) * 100)}%)`
                      : `${formatFileSize(remoteProgress.received)} downloaded`}
                  </span>
                </div>
                {remoteProgress.percent !== null && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(remoteProgress.percent * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Supports remote URLs when the target server allows browser CORS.
            </p>
          </div>

          <ScrollArea className="h-[200px] lg:h-[calc(100vh-10rem)]">
            {files.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No files loaded</p>
                <p className="text-[10px] mt-1">
                  Drag files here or click to select
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={`group flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${
                      activeFileId === file.id
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    <span className="text-base mt-0.5 shrink-0">
                      {FILE_TYPE_ICONS[file.fileType]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-4 ${getFileTypeColor(file.fileType)}`}
                        >
                          {getFileTypeLabel(file.fileType)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Main preview area */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeFile ? (
            <>
              {/* File info bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b bg-muted/20">
                <span className="text-base">
                  {FILE_TYPE_ICONS[activeFile.fileType]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {activeFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {activeFile.type || "Unknown MIME type"} &middot;{" "}
                    {formatFileSize(activeFile.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    className={`text-xs ${getFileTypeColor(activeFile.fileType)}`}
                  >
                    {getFileTypeLabel(activeFile.fileType)}
                  </Badge>
                </div>
              </div>

              {/* Tabs for multi-file navigation (mobile) */}
              {files.length > 1 && (
                <div className="border-b px-4 py-1.5 lg:hidden overflow-x-auto">
                  <Tabs
                    value={activeFileId || ""}
                    onValueChange={setActiveFileId}
                  >
                    <TabsList className="h-8 bg-transparent p-0 gap-1">
                      {files.map((file) => (
                        <TabsTrigger
                          key={file.id}
                          value={file.id}
                          className="h-7 px-2.5 text-xs data-[state=active]:bg-primary/10"
                        >
                          {file.name.length > 15
                            ? file.name.slice(0, 12) + "..."
                            : file.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Preview content — wrapped with LargeFileGate */}
              <div className="flex-1 min-h-0">
                <LargeFileGate
                  file={activeFile}
                  confirmed={previewConfirmedFileIds.has(activeFile.id)}
                  onConfirm={() => {
                    setPreviewConfirmedFileIds((prev) => {
                      const next = new Set(prev);
                      next.add(activeFile.id);
                      return next;
                    });
                  }}
                >
                  <PluginPreviewRenderer
                    file={activeFile}
                    showPluginDebug={process.env.NODE_ENV === "development"}
                  />
                </LargeFileGate>
              </div>
            </>
          ) : (
            /* Empty state - Drop zone */
            <div
              className={`flex-1 flex items-center justify-center p-8 transition-colors ${
                isDragOver ? "bg-primary/5" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div
                className={`flex flex-col items-center gap-6 max-w-md text-center transition-all ${
                  isDragOver ? "scale-105" : ""
                }`}
              >
                {/* Drop zone visual */}
                <div
                  className={`relative w-40 h-40 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all ${
                    isDragOver
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-muted-foreground/25 hover:border-muted-foreground/40"
                  }`}
                >
                  <Upload
                    className={`h-12 w-12 transition-colors ${
                      isDragOver
                        ? "text-primary"
                        : "text-muted-foreground/40"
                    }`}
                  />
                  {isDragOver && (
                    <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragOver ? "将文件拖放到此处" : "FileVista"}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    拖拽文件到此处，或点击浏览。所有处理均在浏览器内完成 — 文件不会离开你的设备。
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pure browser-side file preview. No upload. No server processing.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 w-full max-w-xs">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Browse Files
                  </Button>
                  <Separator className="my-1" />
                  <Button
                    variant="outline"
                    onClick={loadDemoFiles}
                    disabled={loadingDemo}
                    className="gap-2"
                  >
                    {loadingDemo ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Load Demo Files
                  </Button>
                </div>

                {/* Supported formats */}
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Supported formats
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      "PDF",
                      "Markdown",
                      "JSON",
                      "Code",
                      "DOCX",
                      "PPTX",
                      "XLSX",
                      "DOC limited",
                      "HTML",
                      "ZIP",
                      "SVG",
                      "RTF",
                      "EPUB",
                      "Images",
                      "CSV",
                      "Text",
                      "Video",
                      "Audio",
                    ].map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className="text-[10px] px-2 py-0.5"
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-[1600px] mx-auto flex h-10 items-center px-4 md:px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <File className="h-3 w-3" />
              {files.length} file{files.length !== 1 ? "s" : ""} loaded
            </span>
            <span>•</span>
            <span>All processing is local & private</span>
          </div>
          <div className="ml-auto hidden sm:block">
            Built with Next.js + shadcn/ui
          </div>
        </div>
      </footer>
    </div>
  );
}
