# syntax=docker/dockerfile:1.6
# Build CONTEXT = repo root (để pnpm resolve workspace packages @coachio/*).
#   docker build -f apps/web/Dockerfile -t coachio-web:latest .

# ---------- builder: install + nx build ----------
FROM node:20-alpine AS builder
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

# 1) Manifests trước (layer cache). Đủ mọi package trong pnpm-workspace.yaml.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nx.json ./
COPY packages/api-client/package.json    packages/api-client/
COPY packages/design-system/package.json packages/design-system/
COPY apps/web/package.json               apps/web/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 2) Source + build app web. Packages dùng chung transpile qua transpilePackages.
COPY . .

# NEXT_PUBLIC_* được bake lúc build → nhận từ build arg (compose truyền vào).
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN pnpm exec nx build web

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs

# standalone (tracing root = repo root) giữ cây workspace + node_modules đã trace
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
