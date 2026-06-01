/**
 * Shiki highlighter singleton with lazy language & theme loading
 *
 * Architecture:
 * - `shiki/core` (20KB gzip) is the only eager dependency
 * - `createJavaScriptRegexEngine` eliminates WASM (no 226KB gzip overhead)
 * - Each language (`@shikijs/langs/*`) is a separate async chunk, loaded on demand
 * - Each theme (`@shikijs/themes/*`) is a separate async chunk, loaded on demand
 * - `createBundledHighlighter` + `createSingletonShorthands` = auto code-split
 *
 * Loading sequence for first code preview:
 *   0KB → core (20KB) + JS engine (5KB) + 1 language (4-20KB) + 2 themes (8-30KB)
 *   ≈ 37-75KB gzip total for first code file
 *
 * Subsequent previews only load the new language chunk (~4-20KB each)
 */

import { createBundledHighlighter, createSingletonShorthands } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { ShikiTransformer } from "shiki";

// ── Language registry: each entry is a lazy dynamic import ──
// Only the language actually being previewed will be fetched
const languages = {
  // Web
  javascript: () => import("@shikijs/langs/javascript"),
  typescript: () => import("@shikijs/langs/typescript"),
  jsx: () => import("@shikijs/langs/jsx"),
  tsx: () => import("@shikijs/langs/tsx"),
  html: () => import("@shikijs/langs/html"),
  css: () => import("@shikijs/langs/css"),
  scss: () => import("@shikijs/langs/scss"),
  less: () => import("@shikijs/langs/less"),
  vue: () => import("@shikijs/langs/vue"),
  svelte: () => import("@shikijs/langs/svelte"),

  // Scripting
  python: () => import("@shikijs/langs/python"),
  ruby: () => import("@shikijs/langs/ruby"),
  php: () => import("@shikijs/langs/php"),
  perl: () => import("@shikijs/langs/perl"),
  lua: () => import("@shikijs/langs/lua"),
  r: () => import("@shikijs/langs/r"),

  // Systems
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  java: () => import("@shikijs/langs/java"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  scala: () => import("@shikijs/langs/scala"),
  swift: () => import("@shikijs/langs/swift"),
  dart: () => import("@shikijs/langs/dart"),

  // Shell
  bash: () => import("@shikijs/langs/bash"),
  shellscript: () => import("@shikijs/langs/bash"),
  powershell: () => import("@shikijs/langs/powershell"),
  shell: () => import("@shikijs/langs/bash"),

  // Data / Config
  json: () => import("@shikijs/langs/json"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  ini: () => import("@shikijs/langs/ini"),
  sql: () => import("@shikijs/langs/sql"),
  graphql: () => import("@shikijs/langs/graphql"),
  dockerfile: () => import("@shikijs/langs/docker"),
  makefile: () => import("@shikijs/langs/makefile"),
  nginx: () => import("@shikijs/langs/nginx"),
  diff: () => import("@shikijs/langs/diff"),
  xml: () => import("@shikijs/langs/xml"),

  // Markup / Docs
  markdown: () => import("@shikijs/langs/markdown"),
  latex: () => import("@shikijs/langs/latex"),
  asciidoc: () => import("@shikijs/langs/asciidoc"),

  // Functional / Other
  haskell: () => import("@shikijs/langs/haskell"),
  elixir: () => import("@shikijs/langs/elixir"),
  clojure: () => import("@shikijs/langs/clojure"),
  erlang: () => import("@shikijs/langs/erlang"),
  matlab: () => import("@shikijs/langs/matlab"),

  // Additional
  objectivec: () => import("@shikijs/langs/objective-c"),
  objectivecpp: () => import("@shikijs/langs/objective-cpp"),
  coffeescript: () => import("@shikijs/langs/coffeescript"),
  vim: () => import("@shikijs/langs/vim"),
  regex: () => import("@shikijs/langs/regex"),
  wasm: () => import("@shikijs/langs/wasm"),
} as const;

// ── Theme registry: only 2 themes for dual light/dark ──
const themes = {
  "github-light": () => import("@shikijs/themes/github-light"),
  "github-dark": () => import("@shikijs/themes/github-dark"),
} as const;

// ── Create the bundled highlighter with lazy loading ──
const createHighlighter = createBundledHighlighter({
  languages,
  themes,
  engine: () => createJavaScriptRegexEngine(),
});

// ── Singleton shorthands: auto-cached, code-split per language/theme ──
export const { codeToHtml, codeToHast, codeToTokens } =
  createSingletonShorthands(createHighlighter);

/**
 * Map file extension → Shiki language ID
 * Used by CodePreview to determine which language grammar to load
 */
export function getShikiLanguage(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const baseName = fileName.split("/").pop() || "";

  // Direct extension mapping
  const extMap: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    pyw: "python",
    rb: "ruby",
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
    php: "php",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    scala: "scala",
    lua: "lua",
    r: "r",
    dart: "dart",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    vue: "vue",
    svelte: "svelte",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    ps1: "powershell",
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
    md: "markdown",
    mdx: "markdown",
    dockerfile: "dockerfile",
    makefile: "makefile",
    nginx: "nginx",
    diff: "diff",
    patch: "diff",
    tex: "latex",
    pl: "perl",
    pm: "perl",
    ex: "elixir",
    exs: "elixir",
    clj: "clojure",
    cljs: "clojure",
    erl: "erlang",
    hs: "haskell",
    m: "matlab",
    vim: "vim",
    coffee: "coffeescript",
  };

  // Check extension
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

  return "text"; // fallback
}

/** Check if a language is supported (has a lazy entry in registry) */
export function isLanguageSupported(lang: string): boolean {
  return lang in languages || lang === "text";
}

/**
 * Shiki transformer: add `data-line` attribute to each line element
 * for CSS-based line number display (no JS rendering needed)
 */
export function transformerLineNumbers(): ShikiTransformer {
  return {
    name: "line-numbers",
    pre(preProps) {
      // Add class for line number styling
      preProps.class = preProps.class
        ? `${preProps.class} has-line-numbers`
        : "has-line-numbers";
    },
    line(lineProps, line) {
      // Add data-line attribute with 1-based line number
      lineProps["data-line"] = String(line + 1);
    },
  };
}
