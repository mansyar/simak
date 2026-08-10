# ---- Builder Stage ----
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
RUN apk add --no-cache git && git init

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Runner Stage ----
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 simak

COPY --from=builder --chown=simak:nodejs /app/.output /app/.output
COPY --from=builder --chown=simak:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=simak:nodejs /app/drizzle/migrations /app/drizzle/migrations
COPY --from=builder /app/docker/start.sh /app/start.sh

RUN test -f /app/.output/server/index.mjs \
  && test -f /app/.output/server/migrate.mjs \
  && test -f /app/.output/server/seed.mjs \
  && test -f /app/.output/server/assets/fonts/noto-sans/NotoSans-Regular.ttf \
  && test -f /app/.output/server/assets/fonts/noto-sans/NotoSans-Bold.ttf \
  && chmod 0555 /app/start.sh

ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://127.0.0.1:3000/api/health || exit 1
USER simak

# Run migrations before starting the app; the wrapper forwards stop signals
CMD ["/app/start.sh"]
