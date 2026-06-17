/**
 * Shiki highlighter — lazy loading via main entry
 *
 * The `shiki` main entry automatically code-splits each language and theme
 * into separate async chunks. Only the ones actually used are loaded.
 *
 * Loading sequence for first code preview:
 *   0KB (React.lazy) → core + JS engine + 1 lang + 2 themes ≈ 49KB gzip
 *
 * Turbopack/webpack automatically splits each @shikijs/langs/* and
 * @shikijs/themes/* into separate chunks.
 */

import { codeToHtml as shikiCodeToHtml } from "shiki";
import type { ShikiTransformer } from "shiki";

// Re-export for convenience
export { shikiCodeToHtml };

/**
 * Highlight code with dual theme support (light/dark CSS variables)
 *
 * This is a wrapper around shiki's codeToHtml that:
 * - Uses github-light/github-dark dual themes
 * - Outputs CSS variables (defaultColor: false) for zero-cost theme switching
 * - Adds line numbers via transformer
 */
export async function highlightCode(
  content: string,
  language: string
): Promise<string> {
  return shikiCodeToHtml(content, {
    lang: language,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    defaultColor: false,
    transformers: [transformerLineNumbers()],
  });
}

/**
 * Map file extension → Shiki language ID
 */
export function getShikiLanguage(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const baseName = fileName.split("/").pop() || "";

  const extMap: Record<string, string> = {
    // Web
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    vue: "vue",
    svelte: "svelte",
    // Scripting
    py: "python",
    pyw: "python",
    rb: "ruby",
    php: "php",
    pl: "perl",
    pm: "perl",
    lua: "lua",
    r: "r",
    // Systems
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    scala: "scala",
    dart: "dart",
    // Shell
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    ps1: "powershell",
    bat: "bat",
    cmd: "bat",
    // Data / Config
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    ini: "ini",
    cfg: "ini",
    conf: "ini",
    env: "ini",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    xml: "xml",
    svg: "xml",
    // DevOps
    dockerfile: "dockerfile",
    makefile: "makefile",
    nginx: "nginx",
    diff: "diff",
    patch: "diff",
    // Docs
    md: "markdown",
    mdx: "mdx",
    tex: "latex",
    adoc: "asciidoc",
    // Functional / Other
    ex: "elixir",
    exs: "elixir",
    clj: "clojure",
    cljs: "clojure",
    erl: "erlang",
    hs: "haskell",
    m: "matlab",
    vim: "vim",
    coffee: "coffeescript",
    wasm: "wasm",
    objectivec: "objectivec",
    objectivecpp: "objectivec",
  };

  if (extMap[ext]) return extMap[ext];

  // Check base filename (case-insensitive)
  const lowerBase = baseName.toLowerCase();
  if (lowerBase === "dockerfile") return "dockerfile";
  if (lowerBase === "makefile" || lowerBase === "gnumakefile") return "makefile";
  if (lowerBase === "gemfile") return "ruby";
  if (lowerBase === "rakefile") return "ruby";
  if (lowerBase === ".gitignore" || lowerBase === ".env") return "ini";
  if (lowerBase === ".eslintrc" || lowerBase === ".prettierrc") return "json";
  if (lowerBase === "vagrantfile") return "ruby";

  return "text";
}

/**
 * Transformer: add data-line attribute to each line for CSS line numbers
 */
export function transformerLineNumbers(): ShikiTransformer {
  return {
    name: "line-numbers",
    line(lineProps, line) {
      // lineProps is a hast element; properties are in .properties
      if (!lineProps.properties) lineProps.properties = {};
      lineProps.properties["data-line"] = String(line);
    },
  };
}
