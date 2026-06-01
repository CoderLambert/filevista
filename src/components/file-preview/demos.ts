export const DEMO_FILES: Record<string, { name: string; content: string; type: string }> = {
  "readme.md": {
    name: "README.md",
    type: "text/markdown",
    content: `# File Preview Hub

A modern, feature-rich file preview application built with **Next.js** and **shadcn/ui**.

## Supported File Types

| Type | Extensions | Features |
|------|-----------|----------|
| PDF | \`.pdf\` | Inline browser rendering |
| Markdown | \`.md\`, \`.mdx\` | Full GFM support with tables |
| JSON | \`.json\` | Auto-formatting & syntax highlighting |
| Code | \`.js\`, \`.ts\`, \`.py\`, etc. | 30+ languages with line numbers |
| Word | \`.docx\` | HTML conversion with styling |
| PPT | \`.pptx\`, \`.ppt\` | Slide parsing with navigation |
| Images | \`.png\`, \`.jpg\`, \`.svg\`, etc. | Zoom, rotate, reset |
| CSV | \`.csv\` | Sortable table with search |
| Text | \`.txt\`, \`.log\`, \`.env\` | Line numbers, word wrap |
| Video | \`.mp4\`, \`.webm\` | Native browser player |
| Audio | \`.mp3\`, \`.wav\` | Native audio player |

## Getting Started

1. **Drag & drop** any file onto the upload area
2. Or **click** to browse and select files from your computer
3. Preview files instantly in the browser — no upload to server needed!

## Features

- 🚀 **Zero upload** — All processing happens locally in your browser
- 🎨 **Syntax highlighting** — Beautiful code rendering for 30+ languages
- 📊 **CSV tables** — Sortable, searchable table view
- 🖼️ **Image controls** — Zoom in/out, rotate, reset
- 📝 **Markdown** — Full GitHub Flavored Markdown support
- 📄 **Word docs** — Convert .docx to HTML for preview
- 🌙 **Dark mode** — Comfortable viewing in any lighting

## Technical Stack

\`\`\`typescript
const techStack = {
  framework: "Next.js 16",
  language: "TypeScript",
  styling: "Tailwind CSS + shadcn/ui",
  markdown: "react-markdown + remark-gfm",
  codeHighlight: "react-syntax-highlighter",
  docx: "mammoth.js",
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
        name: "file-preview-hub",
        version: "1.0.0",
        description: "A modern file preview application",
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
    content: `// File Preview Hub - TypeScript Example
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
    "docx", "txt",
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
ALLOWED_TYPES=pdf,docx,md,json,csv,txt,png,jpg

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
