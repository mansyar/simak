# TRACK-038: Health Check Endpoint

## Overview

Add a public, unauthenticated `GET /api/health` endpoint that returns the operational health of the SIMAK application as JSON. The endpoint performs three checks — database connectivity, Cloudflare R2 reachability, and email queue depth — and returns HTTP 200 (healthy) or 503 (unhealthy). It is consumed by Coolify/container orchestration for liveness and readiness probes, and by operators for deployment verification.

This track addresses missing production monitoring infrastructure (no audit finding — proactive infrastructure). It formalizes the "health endpoint" already referenced in `conductor/workflow.md` (deployment verification step) and `docs/roadmap.md` TRACK-038.

## Context Anchors (Traceability)

- **PRD Reference:** N/A (infrastructure, no product impact)
- **TDD Reference:** `docs/TDD.md` — Deployment section (Docker multi-stage, Coolify, PgBouncer)
- **Code References:**
  - `src/config/env.ts` — `DATABASE_URL` required, `R2_*` optional
  - `src/db/index.ts` — `getDb()` (throws if `DATABASE_URL` unset)
  - `src/lib/storage.ts` — `getR2Client(): S3Client | null` (null when R2 env vars absent); `getBucketName(): string | null` (currently NOT exported — must be exported for this track)
  - `src/db/schema/email-queue.ts` — `emailQueue` table, `status` enum: `'pending' | 'processing' | 'sent' | 'failed'`
  - `src/routes/api/auth/$.tsx` — existing API route pattern: `createFileRoute` with `server.handlers` object (NOT `createAPIFileRoute`)
  - `docker/Dockerfile` — uses `node:22-alpine` (has `wget` via busybox, no `curl`)

## Architecture Decision

The health-check logic is extracted into a **handler-only server module** `src/server/health.server.ts` exporting a testable `runHealthChecks()` function. The route file `src/routes/api/health.ts` stays thin — it delegates to `runHealthChecks()` and maps the result to an HTTP 200/503 JSON response. This follows the "Handler-only" structural pattern (no `*.ts` stub file; internal helper imported only by the route, never called directly from client code) documented in AGENTS.md.

**Why not inline:** TDD requires writing failing tests first; a pure, importable function is straightforward to unit-test in isolation with mocked `getDb`/`getR2Client`/`emailQueue`, whereas an inline route handler is awkward to exercise without spinning up the router.

**`getBucketName()` export:** `src/lib/storage.ts` currently declares `getBucketName()` without `export`. This track exports it (one-word change) so the health module can obtain the bucket name for `HeadBucketCommand`. (Alternative — reading `process.env.R2_BUCKET_NAME` directly — would duplicate the env-reading logic and bypass the existing abstraction.)

## Functional Requirements

### FR-1: Health Endpoint
- New `GET /api/health` route at `src/routes/api/health.ts` using `createFileRoute('/api/health')` with `server: { handlers: { GET: ... } }` (matching the `src/routes/api/auth/$.tsx` pattern — NOT `createAPIFileRoute`).
- No authentication required — must be reachable by load balancers/containers without credentials.

### FR-2: Three Health Checks
The `runHealthChecks()` function in `src/server/health.server.ts` runs three checks in parallel via `Promise.allSettled`, each with a 2-second timeout (`Promise.race` against a timeout promise). Failed or timed-out checks return an error result but never crash the endpoint.

1. **Database check** — `SELECT 1` via `getDb().execute(sql\`SELECT 1\`)`. Success → `{ status: 'ok' }`. Failure/timeout → `{ status: 'error', error: '<message>' }`.
2. **R2 check** — call `getR2Client()`:
   - If `null` → `{ status: 'not_configured' }` (healthy — R2 is optional).
   - If non-null, send `HeadBucketCommand({ Bucket: getBucketName() })`:
     - Success → `{ status: 'ok' }`.
     - Failure/timeout → `{ status: 'error', error: '<message>' }` (unhealthy).
3. **Email queue check** — `COUNT(*)` on `emailQueue` where `status IN ('pending', 'processing')`. Always returns `{ status: 'ok', depth: <number> }` — informational only, never fails health.

### FR-3: Response Payload
- HTTP 200 with body when **healthy** (DB reachable AND (R2 not configured OR R2 reachable)):
  ```json
  {
    "status": "healthy",
    "timestamp": "<ISO 8601 string>",
    "version": "<app version from package.json>",
    "checks": {
      "database": { "status": "ok" },
      "r2": { "status": "ok" | "not_configured" },
      "emailQueue": { "status": "ok", "depth": 0 }
    }
  }
  ```
- HTTP 503 with body when **unhealthy** (DB unreachable OR R2 configured-but-unreachable). Same shape but `status: "unhealthy"`, and the failing check(s) carry `{ status: "error", error: "..." }`.
- `timestamp` is `new Date().toISOString()`; `version` is read from `package.json`.

### FR-4: Dockerfile HEALTHCHECK
- Add to `docker/Dockerfile`:
  ```
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:3000/api/health || exit 1
  ```
  Uses `wget` (available via busybox on `node:22-alpine` — `curl` is not).

### FR-5: Documentation
- Update `docs/TDD.md` deployment section to note that Coolify can use `/api/health` for liveness/readiness probes.

## Non-Functional Requirements

- **Performance:** Each check bounded to 2s; total endpoint latency ≤ ~2s (checks run in parallel). The endpoint never hangs.
- **PgBouncer compatibility:** DB check uses a simple `SELECT 1` (no session-specific queries) — safe behind PgBouncer transaction pooling.
- **Security:** No auth, no sensitive data exposed. Queue `depth` is a coarse count (no recipient emails or content). No rate limiting (per roadmap — simple enough not to need protection; sits behind Coolify/Traefik).
- **File limits:** `src/server/health.server.ts` and `src/routes/api/health.ts` each under 500 lines.
- **No new dependencies:** `HeadBucketCommand` already in `@aws-sdk/client-s3`.

## Acceptance Criteria

- [ ] `GET /api/health` returns HTTP 200 with `{ status: "healthy", timestamp, version, checks: {...} }` when DB is up and R2 is up or not configured.
- [ ] `GET /api/health` returns HTTP 503 with `status: "unhealthy"` and the failing check's error when DB is down.
- [ ] `GET /api/health` returns HTTP 503 when R2 is configured but unreachable (HeadBucket fails).
- [ ] `GET /api/health` returns HTTP 200 with `r2.status: "not_configured"` when R2 env vars are absent.
- [ ] Email queue `depth` is reported as a number and never causes the endpoint to fail.
- [ ] No check hangs — each times out within 2s; the endpoint responds within ~2s even when dependencies are down.
- [ ] Endpoint requires no authentication.
- [ ] Route uses `createFileRoute` with `server.handlers` (not `createAPIFileRoute`).
- [ ] `docker/Dockerfile` includes the `HEALTHCHECK` directive using `wget`.
- [ ] `docs/TDD.md` deployment section documents `/api/health` for Coolify probes.
- [ ] `getBucketName()` is exported from `src/lib/storage.ts`.
- [ ] Unit tests pass: 200 healthy (DB up + R2 up), 200 healthy (DB up + R2 not_configured), 503 unhealthy (DB down), 503 unhealthy (R2 configured but HEAD fails), 2s timeout behavior, email queue depth reported correctly.
- [ ] `pnpm test:coverage` ≥ 80% on all four metrics; `pnpm typecheck` and `pnpm lint` clean; all files under 500 lines.

## Out of Scope

- Authenticated health check variant (deeper introspection) — future track.
- Metrics endpoint (Prometheus format) — separate future track.
- Database migration check (pending migrations count) — separate concern.
- Rate limiting on the health endpoint — public endpoint, simple enough not to need protection.
- Uptime, commit hash, or build ID in the response — only `timestamp` + `version`.
