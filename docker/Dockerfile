# ---- Builder Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate
RUN apk add --no-cache git && git init

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Runner Stage ----
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 simak

COPY --from=builder --chown=simak:nodejs /app/dist /app/dist
COPY --from=builder --chown=simak:nodejs /app/.output /app/.output
COPY --from=builder --chown=simak:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations

RUN test -f /app/dist/server/server.js \
  && test -f /app/.output/server/migrate.mjs \
  && test -f /app/.output/server/seed.mjs

ENV NODE_ENV=production
EXPOSE 3000

# Health check via the public /api/health endpoint (wget available via busybox on alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:3000/api/health || exit 1

# Run migrations before starting the app
CMD ["sh", "-c", "node .output/server/migrate.mjs && node dist/server/server.js"]
