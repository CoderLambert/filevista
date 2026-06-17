# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @filevista/playground.
#
# Build context MUST be the monorepo root, not apps/playground/:
#
#   docker build -f apps/playground/Dockerfile -t filevista-playground .
#
# The pnpm workspace expects all three package.json files + the root
# lockfile to be on disk for the dep graph to resolve correctly.

# ---------- Stage 1: install all workspace dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Required by sharp at install time
RUN apk add --no-cache libc6-compat

# Pin pnpm to the version declared in the root package.json's
# packageManager field (single source of truth).
RUN corepack enable

# Copy only manifests + lockfile + npmrc so this layer cache only
# invalidates when dependency declarations actually change. The .npmrc
# holds the registry + fetch-timeout settings we need for the larger
# next/swc tarballs.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/playground/package.json apps/playground/
COPY packages/file-preview/package.json packages/file-preview/

# apps/playground's postinstall runs
#   node ../../packages/file-preview/scripts/copy-pdf-worker.mjs
#   node ../../packages/file-preview/scripts/copy-rtfjs-bundles.mjs
# so those script files must already be on disk when pnpm install runs.
COPY packages/file-preview/scripts packages/file-preview/scripts

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable

# Match the store path deps stage used. Without this, any pnpm command
# the build accidentally triggers (e.g. Next.js's auto-install of missing
# TypeScript deps) hits ERR_PNPM_UNEXPECTED_STORE because the existing
# node_modules links into /pnpm/store but pnpm defaults to ~/.local/share/pnpm.
RUN pnpm config set store-dir /pnpm/store

# Bring over the fully resolved workspace (root + apps + packages + their
# node_modules) from deps. A whole-/app copy preserves the workspace
# symlink layout pnpm produced — fine-grained copies risk breaking those.
COPY --from=deps /app ./

# Overlay the rest of the source. .dockerignore prevents node_modules,
# .next, dist, etc. from being re-shipped from the context, so this only
# adds source files.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Root build script builds @filevista/file-preview, then the playground
# (next build + copy static/public into the nested standalone path).
RUN pnpm run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nextjs -G nodejs

# Next.js places its standalone bundle at apps/playground/.next/standalone/
# under monorepo mode (preserving the workspace path so the embedded server
# can resolve sibling packages). The playground build script already copied
# static/ and public/ into the nested apps/playground/ directory there.
COPY --from=builder --chown=nextjs:nodejs /app/apps/playground/.next/standalone ./

USER nextjs
EXPOSE 3000

# server.js lives at apps/playground/server.js inside the standalone tree.
# Node resolves its requires through /app/node_modules (workspace-shared)
# and /app/apps/playground/node_modules (Next bundled both layers).
CMD ["node", "apps/playground/server.js"]
