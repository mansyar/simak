<protect>
# Implementation Plan: TRACK-038 — Health Check Endpoint

## Phase 1: Health Check Module & Route (TDD)

- [ ] Task: Read spec.md and workflow.md to load context for this phase
    - [ ] Read `conductor/tracks/health-check-endpoint_20260728/spec.md`
    - [ ] Read `conductor/workflow.md` (TDD lifecycle, commit format, checkpoint protocol)

- [ ] Task: Write failing unit tests for the health check logic (Red Phase)
    - [ ] Create `tests/unit/server/health.server.test.ts` starting with `/** @vitest-environment node */`
    - [ ] Mock `@/db/index` (`getDb`), `@/lib/storage` (`getR2Client`, `getBucketName`), and `@/db/schema/email-queue` (`emailQueue`)
    - [ ] Test: returns 200 healthy (`status: 'healthy'`) with `timestamp` + `version` + all checks `ok` when DB up + R2 up
    - [ ] Test: returns 200 healthy when DB up + R2 `not_configured` (`getR2Client` returns null)
    - [ ] Test: returns 503 unhealthy when DB down (`getDb().execute` rejects)
    - [ ] Test: returns 503 unhealthy when R2 configured but `HeadBucketCommand` fails (`client.send` rejects)
    - [ ] Test: per-check 2s timeout — a hanging dependency resolves to `{ status: 'error' }` within ~2s; endpoint never hangs
    - [ ] Test: email queue `depth` is a number and never causes unhealthy status
    - [ ] Test: `version` matches `package.json` version; `timestamp` is a valid ISO 8601 string
    - [ ] Run `pnpm test` and confirm the new tests fail as expected (do not proceed until failing)

- [ ] Task: Implement `runHealthChecks()` handler module (Green Phase)
    - [ ] Export `getBucketName()` from `src/lib/storage.ts` (add `export` keyword — one-word change)
    - [ ] Create `src/server/health.server.ts` exporting `runHealthChecks(): Promise<HealthResult>` and the `HealthResult` type
    - [ ] Implement DB check: `getDb().execute(sql\`SELECT 1\`)` wrapped in `Promise.race` with a 2s timeout
    - [ ] Implement R2 check: `getR2Client()` → null = `not_configured`; else `client.send(new HeadBucketCommand({ Bucket: getBucketName() }))` wrapped in 2s timeout
    - [ ] Implement email queue check: `getDb().select({ count: count() }).from(emailQueue).where(inArray(emailQueue.status, ['pending', 'processing']))` — always returns depth
    - [ ] Run the 3 checks in parallel via `Promise.allSettled`; assemble result `{ status, timestamp: new Date().toISOString(), version, checks }`
    - [ ] Derive overall status: `healthy` if DB ok AND (R2 `not_configured` OR R2 ok); else `unhealthy`
    - [ ] Run `pnpm test` and confirm all tests now pass

- [ ] Task: Implement the `GET /api/health` route (Green Phase)
    - [ ] Create `src/routes/api/health.ts` using `createFileRoute('/api/health')` with `server: { handlers: { GET: ... } }` (NOT `createAPIFileRoute`)
    - [ ] In GET handler: call `runHealthChecks()`, return `new Response(JSON.stringify(body), { status: body.status === 'healthy' ? 200 : 503, headers: { 'Content-Type': 'application/json' } })`
    - [ ] No auth/session check (public endpoint)
    - [ ] Run `pnpm test` and confirm all tests pass

- [ ] Task: Verify coverage & quality gates
    - [ ] Run `pnpm test:coverage` — confirm ≥80% on lines, statements, branches, functions
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Confirm `src/server/health.server.ts` and `src/routes/api/health.ts` are each under 500 lines
    - [ ] Run `pnpm check:i18n` — clean (no i18n changes expected, but verify no parity break)

- [ ] Task: Commit code changes & attach git note
    - [ ] Stage `src/lib/storage.ts`, `src/server/health.server.ts`, `src/routes/api/health.ts`, `tests/unit/server/health.server.test.ts`
    - [ ] Commit: `feat(health): Add GET /api/health endpoint with DB, R2, and email queue checks`
    - [ ] Attach git note with task summary to the commit hash

- [ ] Task: Conductor - User Manual Verification 'Health Check Module & Route' (Protocol in workflow.md)

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
