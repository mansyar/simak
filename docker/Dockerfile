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
COPY --from=builder --chown=simak:nodejs /app/drizzle.config.ts /app/drizzle.config.ts

# Install drizzle-kit for running migrations in production
USER root
RUN npm install -g drizzle-kit@0.31.10
USER simak

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations before starting the app
CMD ["sh", "-c", "drizzle-kit migrate && node .output/server/index.mjs"]
