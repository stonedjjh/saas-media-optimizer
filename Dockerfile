# syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# 1. Base Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS base

WORKDIR /app

# Instalar libc6-compat y dependencias nativas mínimas
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# ------------------------------------------------------------------------------
# 2. Dependencies Stage
# ------------------------------------------------------------------------------
FROM base AS dependencies

COPY .npmrc pnpm-workspace.yaml* package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# ------------------------------------------------------------------------------
# 3. Build Stage
# ------------------------------------------------------------------------------
FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

RUN pnpm run build
# Podar dependencias de desarrollo para mantener la imagen ligera
RUN pnpm prune --prod

# ------------------------------------------------------------------------------
# 4. Production Runner Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Usuario sin privilegios por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
