<protect>
# Specification: TRACK-042 — Database Connection Pool Configuration

## Overview

Proactive reliability hardening: configure explicit connection pool settings on the postgres.js client in `src/db/index.ts`. The current `postgres(databaseUrl)` call passes zero options — no pool size, no lifecycle management, no PgBouncer compatibility, no notice routing. This track adds explicit pool configuration, routes PostgreSQL notices through the pino structured logger (consistent with TRACK-040), migrates `getDb()` to use `getEnv()` for Zod-validated config, and adds two new optional env vars (`DB_POOL_MAX`, `DB_PREPARED_STATEMENTS_DISABLED`).

**Track Type:** Chore (infrastructure hardening)
**Milestone:** 12 — Security, Reliability & Real-Time Infrastructure
**Dependencies:** None
**Audit IDs:** None (proactive)

## Problem Statement

`src/db/index.ts` (line 18) calls `postgres(databaseUrl)` with **no options**:

- **No `max`:** postgres.js defaults to 10 connections — correct by accident, not by configuration.
- **No `idle_timeout`:** Idle connections are never recycled, accumulating stale resources.
- **No `connect_timeout`:** No fail-fast behavior when the DB is unreachable — requests hang until OS-level TCP timeout.
- **No `max_lifetime`:** Connections persist indefinitely, surviving DB failovers/restarts as stale connections that produce errors on next use.
- **No `prepare` option on postgres.js or Drizzle:** Both default to `true` (prepared statements enabled). When PgBouncer is introduced in transaction pooling mode, prepared statements break — requires `prepare: false` on **both** the postgres.js client and the Drizzle config.
- **No `onnotice`:** PostgreSQL NOTICE messages are silently swallowed.
- **`process.env.DATABASE_URL` read directly** (line 13) instead of via `getEnv()` — bypasses Zod validation, inconsistent with the rest of the codebase.

Under production load this can cause: connection exhaustion, stale connection errors after DB failovers, broken queries when PgBouncer is introduced, and silent loss of diagnostic notices.

## Functional Requirements

### FR-1: Migrate `getDb()` to use `getEnv()`

`getDb()` in `src/db/index.ts` must read `DATABASE_URL` via `getEnv()` from `src/config/env.ts` instead of `process.env.DATABASE_URL` directly. This routes all configuration through Zod validation for consistency with the rest of the codebase. The manual `if (!databaseUrl) throw new Error(...)` guard is removed — `getEnv()` handles validation.

### FR-2: Explicit pool configuration on `postgres()` call

The `postgres()` constructor must be called with the following options:

| Option | Value | Rationale |
|--------|-------|----------|
| `max` | `env.DB_POOL_MAX` (default 10) | Tunable pool size; 10 is sufficient for single-instance Coolify deployment with background jobs |
| `idle_timeout` | `30` (seconds) | Recycle idle connections after 30s — prevents stale resource accumulation |
| `connect_timeout` | `10` (seconds) | Fail fast when DB is unreachable — prevents indefinite hangs |
| `max_lifetime` | `60 * 30` (30 minutes) | Recycle connections every 30 min — prevents stale connections surviving DB failovers |
| `prepare` | `!env.DB_PREPARED_STATEMENTS_DISABLED` | Enable by default; disable (`false`) for PgBouncer transaction pooling compatibility |

### FR-3: Matching `prepare` on Drizzle config

The `drizzle(client, { schema })` call must include `prepare: !env.DB_PREPARED_STATEMENTS_DISABLED` — matching the postgres.js client setting. When PgBouncer is introduced, both must be `false` simultaneously.

### FR-4: Route PostgreSQL notices through pino

Add an `onnotice` callback to the `postgres()` options that routes PostgreSQL NOTICE messages through the pino structured logger:

```ts
onnotice: (notice) => logger.debug({ event: 'pg_notice', ...notice })
```

This is consistent with TRACK-040's structured logging approach. Notices are logged at `debug` level (diagnostic, not operational).

### FR-5: New optional env vars in Zod schema

Add two new optional env vars to `envSchema` in `src/config/env.ts`:

| Env Var | Zod Schema | Default | Purpose |
|---------|-----------|---------|---------|
| `DB_POOL_MAX` | `z.coerce.number().int().positive().default(10)` | `10` | Maximum DB pool connections |
| `DB_PREPARED_STATEMENTS_DISABLED` | Custom string-to-boolean transform (NOT `z.coerce.boolean()` — `Boolean('false')` is `true`) | `false` | Disable prepared statements for PgBouncer compatibility |

> **Critical implementation note:** `z.coerce.boolean()` uses `Boolean(value)`, which returns `true` for any non-empty string including `'false'`. A custom transform or `z.preprocess` that checks `val === 'true'` is required.

### FR-6: Document new env vars in `.env.example`

Add `DB_POOL_MAX` and `DB_PREPARED_STATEMENTS_DISABLED` to `.env.example` with descriptive comments explaining their purpose and defaults.

## Non-Functional Requirements

### NFR-1: No behavioral change to existing queries

This track is configuration-only — no query logic, schema, or handler changes. All existing tests must pass unchanged (mocks updated for `getEnv()` / logger imports where needed).

### NFR-2: Singleton invariant preserved

`getDb()` must remain a singleton (returns cached `_db` on subsequent calls). The lazy proxy (`createLazyDb()`) must continue working unchanged.

### NFR-3: File limit compliance

`src/db/index.ts` must remain under 500 lines (current: 36 lines — minimal growth expected). `src/config/env.ts` must remain under 500 lines (current: 42 lines).

## Acceptance Criteria

1. **AC-1:** `postgres()` call in `src/db/index.ts` has explicit pool config with all 5 options (`max`, `idle_timeout`, `connect_timeout`, `max_lifetime`, `prepare`).
2. **AC-2:** `drizzle()` call in `src/db/index.ts` has matching `prepare` option.
3. **AC-3:** `onnotice` callback routes PostgreSQL notices through pino at `debug` level.
4. **AC-4:** `getDb()` uses `getEnv()` for `DATABASE_URL` — no direct `process.env` access.
5. **AC-5:** `DB_POOL_MAX` and `DB_PREPARED_STATEMENTS_DISABLED` are validated by Zod in `env.ts` with sensible defaults (10 and false respectively).
6. **AC-6:** `.env.example` documents both new env vars with comments.
7. **AC-7:** Existing env tests updated to include new vars; new pool config tests verify `getDb()` returns a configured client with correct pool options.
8. **AC-8:** PgBouncer compatibility verified: `DB_PREPARED_STATEMENTS_DISABLED=true` sets `prepare: false` on both postgres.js and Drizzle.
9. **AC-9:** `pnpm typecheck` passes.
10. **AC-10:** `pnpm lint` passes.
11. **AC-11:** `pnpm test` passes (all existing tests + new tests).
12. **AC-12:** `pnpm test:coverage` meets >=80% thresholds on all four metrics.

## Out of Scope

- **SSL/TLS configuration:** Coolify manages the DB connection locally (no TLS needed). Local dev uses docker-compose without SSL. Add later if a remote DB requires it.
- **Migration runner (`src/db/migrate.ts`):** Already correctly configured (`max: 1` + `onnotice: () => {}`) for single-connection migration use. Not touched in this track.
- **Connection pool monitoring/observability UI:** No admin dashboard for pool stats. Pool sizing guidance documented in `conductor/tech-stack.md` only.
- **Multi-instance pool coordination (Redis-backed):** In-memory singleton is sufficient for single-instance Coolify deployment.
- **`closeDb()` / pool shutdown:** Tracked separately in TRACK-045 (Graceful Shutdown & Background Processor Drain).
</protect>
