import type { NextConfig } from "next";

const isGithubPages = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github-pages";

const repoName = "filevista";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : "standalone",

  basePath,
  assetPrefix: basePath,

  trailingSlash: isGithubPages,

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  serverExternalPackages: isGithubPages ? [] : ["docx-preview", "shiki"],
};

export default nextConfig;
