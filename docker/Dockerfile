# ---- Builder Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Runner Stage ----
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 simak

COPY --from=builder --chown=simak:nodejs /app/.output /app/.output
COPY --from=builder --chown=simak:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations

ENV NODE_ENV=production
EXPOSE 3000

# Health check via the public /api/health endpoint (wget available via busybox on alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:3000/api/health || exit 1

# Run migrations before starting the app
CMD ["sh", "-c", "node .output/server/migrate.mjs && node .output/server/index.mjs"]
