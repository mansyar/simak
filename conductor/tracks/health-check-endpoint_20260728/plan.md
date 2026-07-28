<protect>
# Implementation Plan: TRACK-038 — Health Check Endpoint

## Phase 1: Health Check Module & Route (TDD)

- [x] Task: Read spec.md and workflow.md to load context for this phase
    - [x] Read `conductor/tracks/health-check-endpoint_20260728/spec.md`
    - [x] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [x] Task: Write failing unit tests for the health check logic (Red Phase)
    - [x] Create `tests/unit/server/health.server.test.ts` starting with `/** @vitest-environment node */`
    - [x] Mock `@/db/index` (`getDb`), `@/lib/storage` (`getR2Client`, `getBucketName`), and `@/db/schema/email-queue` (`emailQueue`)
    - [x] Test: returns 200 healthy (`status: 'healthy'`) with `timestamp` + `version` + all checks `ok` when DB up + R2 up
    - [x] Test: returns 200 healthy when DB up + R2 `not_configured` (`getR2Client` returns null)
    - [x] Test: returns 503 unhealthy when DB down (`getDb().execute` rejects)
    - [x] Test: returns 503 unhealthy when R2 configured but `HeadBucketCommand` fails (`client.send` rejects)
    - [x] Test: per-check 2s timeout — a hanging dependency resolves to `{ status: 'error' }` within ~2s; endpoint never hangs
    - [x] Test: email queue `depth` is a number and never causes unhealthy status
    - [x] Test: `version` matches `package.json` version; `timestamp` is a valid ISO 8601 string
    - [x] Run `pnpm test` and confirm the new tests fail as expected (do not proceed until failing)

- [x] Task: Implement `runHealthChecks()` handler module (Green Phase)
    - [x] Export `getBucketName()` from `src/lib/storage.ts` (add `export` keyword — one-word change)
    - [x] Create `src/server/health.server.ts` exporting `runHealthChecks(): Promise<HealthResult>` and the `HealthResult` type
    - [x] Implement DB check: `getDb().execute(sql\`SELECT 1\`)` wrapped in `Promise.race` with a 2s timeout
    - [x] Implement R2 check: `getR2Client()` → null = `not_configured`; else `client.send(new HeadBucketCommand({ Bucket: getBucketName() }))` wrapped in 2s timeout
    - [x] Implement email queue check: `getDb().select({ count: count() }).from(emailQueue).where(inArray(emailQueue.status, ['pending', 'processing']))` — always returns depth
    - [x] Run the 3 checks in parallel via `Promise.allSettled`; assemble result `{ status, timestamp: new Date().toISOString(), version, checks }`
    - [x] Derive overall status: `healthy` if DB ok AND (R2 `not_configured` OR R2 ok); else `unhealthy`
    - [x] Run `pnpm test` and confirm all tests now pass

- [x] Task: Implement the `GET /api/health` route (Green Phase)
    - [x] Create `src/routes/api/health.ts` using `createFileRoute('/api/health')` with `server: { handlers: { GET: ... } }` (NOT `createAPIFileRoute`)
    - [x] In GET handler: call `runHealthChecks()`, return `new Response(JSON.stringify(body), { status: body.status === 'healthy' ? 200 : 503, headers: { 'Content-Type': 'application/json' } })`
    - [x] No auth/session check (public endpoint)
    - [x] Run `pnpm test` and confirm all tests pass

- [x] Task: Verify coverage & quality gates
    - [x] Run `pnpm test:coverage` — confirm ≥80% on lines, statements, branches, functions
    - [x] Run `pnpm typecheck` — clean
    - [x] Run `pnpm lint` — clean
    - [x] Confirm `src/server/health.server.ts` and `src/routes/api/health.ts` are each under 500 lines
    - [x] Run `pnpm check:i18n` — clean (no i18n changes expected, but verify no parity break)

- [x] Task: Commit code changes & attach git note [987c5f1]
    - [x] Stage `src/lib/storage.ts`, `src/server/health.server.ts`, `src/routes/api/health.ts`, `src/routeTree.gen.ts`, `tests/unit/server/health.server.test.ts`
    - [x] Commit: `feat(health): Add GET /api/health endpoint with DB, R2, and email queue checks`
    - [x] Attach git note with task summary to the commit hash

- [x] Task: Conductor - User Manual Verification 'Health Check Module & Route' (Protocol in workflow.md)

## Phase 2: Deployment Integration

- [ ] Task: Read spec.md and workflow.md to load context for this phase
    - [ ] Read `conductor/tracks/health-check-endpoint_20260728/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Add HEALTHCHECK to `docker/Dockerfile`
    - [ ] Add `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:3000/api/health || exit 1`
    - [ ] Confirm `wget` is the correct tool (`node:22-alpine` busybox has `wget`, not `curl`)

- [ ] Task: Update `docs/TDD.md` deployment section
    - [ ] Document that Coolify can use `GET /api/health` for liveness/readiness probes
    - [ ] Note the 200/503 contract and the three checks (DB, R2, email queue depth)

- [ ] Task: Verify quality gates
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Confirm `docker/Dockerfile` HEALTHCHECK uses `wget` (not `curl`)

- [ ] Task: Commit deployment integration changes & attach git note
    - [ ] Stage `docker/Dockerfile`, `docs/TDD.md`
    - [ ] Commit: `chore(deploy): Add Dockerfile HEALTHCHECK and document /api/health for Coolify probes`
    - [ ] Attach git note with task summary to the commit hash

- [ ] Task: Conductor - User Manual Verification 'Deployment Integration' (Protocol in workflow.md)
</protect>
