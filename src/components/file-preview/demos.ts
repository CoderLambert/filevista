// ── Text-based demo files (inline content) ──
export const DEMO_FILES: Record<string, { name: string; content: string; type: string }> = {
  "readme.md": {
    name: "README.md",
    type: "text/markdown",
    content: `# FileVista

纯浏览器端文件预览工具集，基于 **Next.js** 和 **shadcn/ui** 构建。

## Supported File Types

| Type | Extensions | Features |
|------|-----------|----------|
| PDF | \`.pdf\` | Inline browser rendering |
| Markdown | \`.md\`, \`.mdx\` | Full GFM + Shiki code highlighting |
| JSON | \`.json\` | Auto-formatting & syntax highlighting |
| Code | \`.js\`, \`.ts\`, \`.py\`, etc. | 50+ languages with line numbers |
| Word | \`.docx\` | High-fidelity rendering with docx-preview |
| PPT | \`.pptx\`, \`.ppt\` | Slide parsing with navigation |
| Excel | \`.xlsx\` | Full fidelity with styles, merges & images |
| EPUB | \`.epub\` | Chapter navigation, TOC & images |
| Images | \`.png\`, \`.jpg\`, \`.svg\`, etc. | Zoom, rotate, reset |
| CSV | \`.csv\` | Sortable table with search |
| Text | \`.txt\`, \`.log\`, \`.env\` | Line numbers, word wrap |
| Video | \`.mp4\`, \`.webm\` | Native browser player |
| Audio | \`.mp3\`, \`.wav\` | Native audio player |

## Getting Started

1. **Drag & drop** any file onto the upload area
2. Or **click** to browse and select files from your computer
3. Preview files instantly in the browser — no upload to server needed!

## Code Highlighting

All code blocks in Markdown are syntax-highlighted using **Shiki** — the same engine that powers VS Code. Try it:

\`\`\`typescript
interface PreviewConfig {
  maxFileSize: number;
  theme: "light" | "dark" | "system";
  highlighter: "shiki";
}

function createPreview(config: PreviewConfig) {
  return {
    ...config,
    ready: true,
  };
}
\`\`\`

\`\`\`python
class FilePreviewEngine:
    """Preview files in the browser."""

    def __init__(self, max_size: int = 50_000_000):
        self.max_size = max_size
        self.cache: dict[str, str] = {}

    async def preview(self, file_path: str) -> str:
        if file_path in self.cache:
            return self.cache[file_path]
        content = await self._read(file_path)
        self.cache[file_path] = content
        return content
\`\`\`

\`\`\`css
.code-block {
  font-family: "SF Mono", Menlo, monospace;
  background: var(--shiki-light-bg);
  color: var(--shiki-light);
  border-radius: 0.5rem;
  padding: 1rem;
}

@media (prefers-color-scheme: dark) {
  .code-block {
    background: var(--shiki-dark-bg);
    color: var(--shiki-dark);
  }
}
\`\`\`

\`\`\`bash
# Install dependencies
bun add shiki @shikijs/langs @shikijs/themes

# Run dev server
bun run dev
\`\`\`

## Features

- 🚀 **Zero upload** — All processing happens locally in your browser
- 🎨 **Shiki highlighting** — VS Code-quality rendering for 50+ languages
- 📊 **Excel preview** — Full fidelity with styles, merged cells & images
- 📖 **EPUB reader** — Chapter navigation, TOC sidebar & embedded images
- 📊 **CSV tables** — Sortable, searchable table view
- 🖼️ **Image controls** — Zoom in/out, rotate, reset
- 📝 **Markdown** — Full GFM support with code block highlighting
- 📄 **Word docs** — High-fidelity rendering with docx-preview
- 🌙 **Dark mode** — Dual-theme code blocks, zero re-render

## Technical Stack

\`\`\`typescript
const techStack = {
  framework: "Next.js 16",
  language: "TypeScript",
  styling: "Tailwind CSS + shadcn/ui",
  markdown: "react-markdown + remark-gfm + Shiki",
  codeHighlight: "Shiki (VS Code engine)",
  docx: "docx-preview",
  excel: "exceljs",
  epub: "jszip",
  icons: "Lucide React",
};
\`\`\`

> 💡 **Privacy First**: Your files never leave your device. All preview processing happens entirely in the browser using client-side JavaScript.

---

*Built with ❤️ using Next.js and shadcn/ui*
`,
  },
  "package.json": {
    name: "package.json",
    type: "application/json",
    content: JSON.stringify(
      {
        name: "filevista",
        version: "1.0.0",
        description: "A client-side file preview toolset",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "eslint .",
        },
        dependencies: {
          next: "^16.1.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "react-markdown": "^10.1.0",
          "react-syntax-highlighter": "^15.6.1",
          mammoth: "^1.8.0",
          exceljs: "^4.4.0",
          jszip: "^3.10.1",
          "lucide-react": "^0.525.0",
          "tailwindcss": "^4.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
          "@types/react": "^19.0.0",
          eslint: "^9.0.0",
        },
      },
      null,
      2
    ),
  },
  "example.ts": {
    name: "example.ts",
    type: "text/typescript",
    content: `// FileVista - TypeScript Example
// This file demonstrates various TypeScript features

interface FilePreviewConfig {
  maxFileSize: number;
  supportedTypes: string[];
  theme: "light" | "dark" | "system";
  enableLineNumbers: boolean;
}

type FileCategory = "document" | "code" | "media" | "data";

interface PreviewResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

class FilePreviewEngine {
  private config: FilePreviewConfig;
  private cache: Map<string, PreviewResult>;

  constructor(config: FilePreviewConfig) {
    this.config = config;
    this.cache = new Map();
  }

  async previewFile(file: File): Promise<PreviewResult> {
    // Check cache first
    const cacheKey = \`\${file.name}-\${file.size}-\${file.lastModified}\`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Validate file type
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !this.config.supportedTypes.includes(extension)) {
      return {
        success: false,
        content: "",
        error: \`Unsupported file type: .\${extension}\`,
      };
    }

    // Validate file size
    if (file.size > this.config.maxFileSize) {
      return {
        success: false,
        content: "",
        error: "File size exceeds maximum allowed size",
      };
    }

    try {
      const content = await this.readFileContent(file);
      const result: PreviewResult = {
        success: true,
        content,
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified),
        },
      };

      // Cache the result
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      return {
        success: false,
        content: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      
      const category = this.getCategory(file.name);
      if (category === "media") {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  private getCategory(fileName: string): FileCategory {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const codeExts = ["ts", "js", "py", "rs", "go", "java", "c", "cpp"];
    const docExts = ["md", "txt", "pdf", "docx"];
    const dataExts = ["json", "csv", "yaml", "toml"];
    const mediaExts = ["png", "jpg", "mp4", "mp3"];

    if (codeExts.includes(ext)) return "code";
    if (docExts.includes(ext)) return "document";
    if (dataExts.includes(ext)) return "data";
    if (mediaExts.includes(ext)) return "media";
    return "code"; // default
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Usage example
const engine = new FilePreviewEngine({
  maxFileSize: 50 * 1024 * 1024, // 50MB
  supportedTypes: [
    "pdf", "md", "json", "csv",
    "ts", "js", "py", "rs",
    "png", "jpg", "svg",
    "docx", "xlsx", "epub", "txt",
  ],
  theme: "system",
  enableLineNumbers: true,
});

export { FilePreviewEngine, type FilePreviewConfig, type PreviewResult };
`,
  },
  "data.csv": {
    name: "data.csv",
    type: "text/csv",
    content: `Name,Role,Department,Salary,Experience,Location,Rating
Alice Chen,Senior Engineer,Engineering,145000,8,San Francisco,4.8
Bob Smith,Product Manager,Product,138000,6,New York,4.5
Carol Wang,Designer,Design,125000,5,Seattle,4.7
David Lee,Data Scientist,Analytics,152000,9,San Francisco,4.9
Emma Wilson,Frontend Dev,Engineering,118000,4,Austin,4.3
Frank Zhang,Backend Dev,Engineering,122000,5,Seattle,4.6
Grace Liu,DevOps Engineer,Infrastructure,135000,7,San Francisco,4.4
Henry Brown,QA Engineer,Quality,105000,3,New York,4.2
Ivy Taylor,ML Engineer,AI/ML,148000,8,San Francisco,4.8
Jack Anderson,Security Engineer,Security,142000,7,Austin,4.7
Kelly Martin,Tech Lead,Engineering,165000,12,Seattle,4.9
Leo Garcia,Full Stack Dev,Engineering,130000,6,Austin,4.5`,
  },
  "config.env": {
    name: "config.env",
    type: "text/plain",
    content: `# Application Configuration
# ========================

# Server Settings
PORT=3000
HOST=localhost
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=24h
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads
ALLOWED_TYPES=pdf,docx,md,json,csv,txt,png,jpg,xlsx,epub

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=./logs

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_METHODS=GET,POST,PUT,DELETE

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100`,
  },
};

// ── Binary demo files (fetched from public/demo/ at runtime) ──
export const DEMO_BINARY_FILES: Record<
  string,
  { name: string; type: string; url: string }
> = {
  epub: {
    name: "精通Python爬虫框架Scrapy.epub",
    type: "application/epub+zip",
    url: "/demo/精通Python爬虫框架Scrapy.epub",
  },
  xlsx: {
    name: "test_features.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    url: "/demo/test_features.xlsx",
  },
  docx: {
    name: "demo.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    url: "/demo/demo.docx",
  },
};

/**
 * Fetch binary demo files and convert to FileInfo-compatible format.
 * Returns array of { name, type, content (base64), size } entries.
 */
export async function fetchBinaryDemoFiles(): Promise<
  { name: string; type: string; content: string; size: number }[]
> {
  const results: { name: string; type: string; content: string; size: number }[] = [];

  for (const [, demo] of Object.entries(DEMO_BINARY_FILES)) {
    try {
      const response = await fetch(demo.url);
      if (!response.ok) continue;

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:...;base64, prefix
        };
        reader.readAsDataURL(blob);
      });

      results.push({
        name: demo.name,
        type: demo.type,
        content: base64,
        size: blob.size,
      });
    } catch {
      // Skip files that fail to load
      console.warn(`Failed to load demo file: ${demo.name}`);
    }
  }

  return results;
}
