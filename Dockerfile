# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Required by sharp/canvas/prisma at install time
RUN apk add --no-cache libc6-compat openssl

# Enable pnpm via corepack (pinned to package.json's packageManager field)
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY scripts ./scripts
# postinstall (copy-pdf-worker, copy-rtfjs-bundles) writes into ./public
COPY public ./public

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/public ./public
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nextjs -G nodejs

# `pnpm run build` already copies static + public into .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
