import path from "node:path";
import type { NextConfig } from "next";

const isGithubPages = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github-pages";

const repoName = "filevista";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : "standalone",

  // Trace files from the monorepo root so standalone bundles @filevista/file-preview
  // (and the rest of the workspace) correctly. Without this, Next defaults to the
  // app directory and silently drops cross-package symlinks.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),

  basePath,
  assetPrefix: basePath,

  trailingSlash: isGithubPages,

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // Workspace package ships uncompiled TS — let Next transpile it.
  transpilePackages: ["@filevista/file-preview"],

  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  serverExternalPackages: isGithubPages ? [] : ["docx-preview", "shiki"],
};

export default nextConfig;
