/**
 * Language registry with dynamic imports for highlight.js
 *
 * Each language grammar is loaded on-demand — only the language
 * being previewed is fetched, instead of bundling all 190+ languages.
 *
 * Usage:
 *   const registerLang = LANGUAGE_REGISTRY["javascript"];
 *   if (registerLang) await registerLang(hljs);
 */

import type HLJS from "highlight.js";

type LanguageRegister = (hljs: typeof HLJS) => Promise<void> | void;

export const LANGUAGE_REGISTRY: Record<string, LanguageRegister> = {
  // ── Web ──
  javascript: (hljs) => import("highlight.js/lib/languages/javascript").then((m) => hljs.registerLanguage("javascript", m.default)),
  typescript: (hljs) => import("highlight.js/lib/languages/typescript").then((m) => hljs.registerLanguage("typescript", m.default)),
  jsx: (hljs) => import("highlight.js/lib/languages/javascript").then((m) => hljs.registerLanguage("javascript", m.default)),
  tsx: (hljs) => import("highlight.js/lib/languages/typescript").then((m) => hljs.registerLanguage("typescript", m.default)),
  html: (hljs) => import("highlight.js/lib/languages/xml").then((m) => hljs.registerLanguage("xml", m.default)),
  xml: (hljs) => import("highlight.js/lib/languages/xml").then((m) => hljs.registerLanguage("xml", m.default)),
  css: (hljs) => import("highlight.js/lib/languages/css").then((m) => hljs.registerLanguage("css", m.default)),
  scss: (hljs) => import("highlight.js/lib/languages/scss").then((m) => hljs.registerLanguage("scss", m.default)),
  less: (hljs) => import("highlight.js/lib/languages/less").then((m) => hljs.registerLanguage("less", m.default)),

  // ── Scripting ──
  python: (hljs) => import("highlight.js/lib/languages/python").then((m) => hljs.registerLanguage("python", m.default)),
  ruby: (hljs) => import("highlight.js/lib/languages/ruby").then((m) => hljs.registerLanguage("ruby", m.default)),
  php: (hljs) => import("highlight.js/lib/languages/php").then((m) => hljs.registerLanguage("php", m.default)),
  perl: (hljs) => import("highlight.js/lib/languages/perl").then((m) => hljs.registerLanguage("perl", m.default)),
  lua: (hljs) => import("highlight.js/lib/languages/lua").then((m) => hljs.registerLanguage("lua", m.default)),
  r: (hljs) => import("highlight.js/lib/languages/r").then((m) => hljs.registerLanguage("r", m.default)),

  // ── Systems ──
  c: (hljs) => import("highlight.js/lib/languages/c").then((m) => hljs.registerLanguage("c", m.default)),
  cpp: (hljs) => import("highlight.js/lib/languages/cpp").then((m) => hljs.registerLanguage("cpp", m.default)),
  csharp: (hljs) => import("highlight.js/lib/languages/csharp").then((m) => hljs.registerLanguage("csharp", m.default)),
  java: (hljs) => import("highlight.js/lib/languages/java").then((m) => hljs.registerLanguage("java", m.default)),
  go: (hljs) => import("highlight.js/lib/languages/go").then((m) => hljs.registerLanguage("go", m.default)),
  rust: (hljs) => import("highlight.js/lib/languages/rust").then((m) => hljs.registerLanguage("rust", m.default)),
  kotlin: (hljs) => import("highlight.js/lib/languages/kotlin").then((m) => hljs.registerLanguage("kotlin", m.default)),
  scala: (hljs) => import("highlight.js/lib/languages/scala").then((m) => hljs.registerLanguage("scala", m.default)),
  swift: (hljs) => import("highlight.js/lib/languages/swift").then((m) => hljs.registerLanguage("swift", m.default)),
  dart: (hljs) => import("highlight.js/lib/languages/dart").then((m) => hljs.registerLanguage("dart", m.default)),

  // ── Shell ──
  bash: (hljs) => import("highlight.js/lib/languages/bash").then((m) => hljs.registerLanguage("bash", m.default)),
  shell: (hljs) => import("highlight.js/lib/languages/bash").then((m) => hljs.registerLanguage("bash", m.default)),
  powershell: (hljs) => import("highlight.js/lib/languages/powershell").then((m) => hljs.registerLanguage("powershell", m.default)),

  // ── Data / Config ──
  json: (hljs) => import("highlight.js/lib/languages/json").then((m) => hljs.registerLanguage("json", m.default)),
  yaml: (hljs) => import("highlight.js/lib/languages/yaml").then((m) => hljs.registerLanguage("yaml", m.default)),
  toml: (hljs) => import("highlight.js/lib/languages/ini").then((m) => hljs.registerLanguage("ini", m.default)),
  ini: (hljs) => import("highlight.js/lib/languages/ini").then((m) => hljs.registerLanguage("ini", m.default)),
  sql: (hljs) => import("highlight.js/lib/languages/sql").then((m) => hljs.registerLanguage("sql", m.default)),
  graphql: (hljs) => import("highlight.js/lib/languages/graphql").then((m) => hljs.registerLanguage("graphql", m.default)),
  dockerfile: (hljs) => import("highlight.js/lib/languages/dockerfile").then((m) => hljs.registerLanguage("dockerfile", m.default)),
  makefile: (hljs) => import("highlight.js/lib/languages/makefile").then((m) => hljs.registerLanguage("makefile", m.default)),
  nginx: (hljs) => import("highlight.js/lib/languages/nginx").then((m) => hljs.registerLanguage("nginx", m.default)),
  diff: (hljs) => import("highlight.js/lib/languages/diff").then((m) => hljs.registerLanguage("diff", m.default)),

  // ── Markup / Docs ──
  markdown: (hljs) => import("highlight.js/lib/languages/markdown").then((m) => hljs.registerLanguage("markdown", m.default)),
  latex: (hljs) => import("highlight.js/lib/languages/latex").then((m) => hljs.registerLanguage("latex", m.default)),
  asciidoc: (hljs) => import("highlight.js/lib/languages/asciidoc").then((m) => hljs.registerLanguage("asciidoc", m.default)),

  // ── Functional / Other ──
  haskell: (hljs) => import("highlight.js/lib/languages/haskell").then((m) => hljs.registerLanguage("haskell", m.default)),
  elixir: (hljs) => import("highlight.js/lib/languages/elixir").then((m) => hljs.registerLanguage("elixir", m.default)),
  clojure: (hljs) => import("highlight.js/lib/languages/clojure").then((m) => hljs.registerLanguage("clojure", m.default)),
  erlang: (hljs) => import("highlight.js/lib/languages/erlang").then((m) => hljs.registerLanguage("erlang", m.default)),
  matlab: (hljs) => import("highlight.js/lib/languages/matlab").then((m) => hljs.registerLanguage("matlab", m.default)),

  // ── Template ──
  plaintext: () => Promise.resolve(),
  text: () => Promise.resolve(),
};

/** Track which languages have already been registered to avoid re-importing */
const registeredLanguages = new Set<string>();

/**
 * Ensure a language is registered with the hljs instance.
 * Returns true if the language was newly registered, false if already registered.
 */
export async function ensureLanguageRegistered(
  hljs: typeof HLJS,
  language: string
): Promise<boolean> {
  // Normalize aliases
  const normalizedLang = normalizeLanguage(language);

  if (registeredLanguages.has(normalizedLang)) {
    return false;
  }

  const register = LANGUAGE_REGISTRY[normalizedLang];
  if (register) {
    await register(hljs);
    registeredLanguages.add(normalizedLang);
    return true;
  }

  // Fallback: try to load from highlight.js/languages/ dynamically
  try {
    const mod = await import(`highlight.js/lib/languages/${normalizedLang}`);
    hljs.registerLanguage(normalizedLang, mod.default);
    registeredLanguages.add(normalizedLang);
    return true;
  } catch {
    console.warn(`[CodePreview] No highlight.js grammar for language: ${normalizedLang}`);
    return false;
  }
}

/** Normalize language aliases to their canonical form */
function normalizeLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    cs: "csharp",
    objC: "objectivec",
    vue: "html",
    svelte: "html",
    htm: "html",
  };
  return aliases[lang] || lang;
}
