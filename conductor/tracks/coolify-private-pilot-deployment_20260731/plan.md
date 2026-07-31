<protect>
# Implementation Plan: TRACK-047 — Coolify Private-Pilot Deployment

## Phase 0: Deployment Baseline & Release Evidence

- [x] Task: Re-read the approved specification and `conductor/workflow.md` [18bb033]
  - [x] Confirm deployment scope, quality gates, and evidence requirements.
  - [x] Record the target source branch and revision for the pilot release.
    - Pilot release baseline: `track-047/coolify-private-pilot-deployment` at `a95e2c5272c40f25e06ff15711f9c12d01b2cf68`.
- [x] Task: Validate the production artifact before Coolify configuration [5adf406]
  - [x] Run `pnpm test:coverage`, `pnpm typecheck`, and `pnpm lint`.
  - [x] Build the production image using `docker/Dockerfile`.
  - [x] Verify the image contains the app, migration runner, seed runner, migrations, and `/api/health` health check.
- [x] Task: Document the release baseline and pre-deployment prerequisites [01bedac]
  - Release candidate: `5adf406d` (`fix(build): restore production Docker build`), built locally as `simak:pilot-baseline`.
  - Quality evidence: coverage (3,948 tests; statements 89.35%, branches 81.05%, functions 83.44%, lines 90.09%), typecheck, lint (0 errors), `pnpm build`, and Docker artifact checks pass.
  - Before Coolify configuration, the operator needs: Coolify project access, repository access to this branch, control of the pilot-domain DNS zone, and a Coolify-managed PostgreSQL 16 service with persistent storage.
  - Coolify-only configuration inventory: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, and private R2 values (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Leave optional `R2_PUBLIC_URL` unset unless a separately approved public R2 custom domain is needed. Optional runtime settings are `LOG_LEVEL`, `DB_POOL_MAX`, and `SHUTDOWN_TIMEOUT_MS`; set `DB_PREPARED_STATEMENTS_DISABLED=true` only when PgBouncer is used.
  - Keep all secret values in Coolify, prepare a backup before the first migration, and run `node .output/server/seed.mjs` once only after the initial deployment is healthy.
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`) [01bedac]

## Phase 1: Provision Coolify Pilot Infrastructure

- [x] Task: Create the isolated Coolify project and environment for the private pilot [a005a21]
  - Coolify project `simak-private-pilot` and environment `production` created by the operator; no application or database has been added yet.
- [x] Task: Provision a Coolify-managed PostgreSQL 16 service [b6eec00]
  - [x] Enable persistent database storage.
  - [x] Generate and store unique database credentials exclusively in Coolify.
  - [x] Restrict database networking to the application service.
  - Operator confirmed `simak-postgres` (PostgreSQL 16, database `simak`) is running and healthy with generated credentials and no public exposure.
- [x] Task: Create the SIMAK application service from the repository Dockerfile [3032252]
  - [x] Configure the production build context and `docker/Dockerfile`.
  - [x] Configure the container port and `/api/health` health probe.
  - [x] Configure restart and deployment behavior appropriate for a single-instance pilot.
  - Operator configured `mansyar/simak` at `track-047/coolify-private-pilot-deployment` with base directory `/`, `docker/Dockerfile`, port `3000`, and `/api/health`; deployment is manual and uses Coolify's default single-container behavior (no scaling control is exposed), with normal restart-on-failure behavior. The application remains undeployed pending Phase 2 runtime secrets.
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`) [3032252]

## Phase 2: Configure Production Runtime & First Release

- [x] Task: Configure the complete production environment in Coolify [e1db409]
  - [x] Set `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `BETTER_AUTH_URL`, authentication secrets, Resend, private R2, and SuperAdmin settings as Coolify runtime-only values. Use the application defaults for logging and pool settings; leave `R2_PUBLIC_URL` unset to keep the bucket private.
  - [x] Ensure `MIGRATE_DATABASE_URL` reaches PostgreSQL directly and leave `DB_PREPARED_STATEMENTS_DISABLED` unset because PgBouncer is not used.
  - [x] Confirm configured values remain masked and Coolify-only; repository and documentation record names only. Application-log secret review is deferred until Phase 4 after a deployment.
  - Operator configured the approved pilot origin `https://simak.ansyar-world.top` without disclosing any secret value.
- [x] Task: Configure the custom pilot domain and TLS [9cbc551]
  - [x] Point DNS to the VPS/Coolify ingress.
  - [x] Attach the domain in Coolify; verify a valid certificate after the first application deployment.
  - [x] Confirm HTTP redirects to HTTPS.
  - Operator confirmed `simak.ansyar-world.top` points directly to the Coolify ingress with Cloudflare proxying disabled for certificate issuance.
  - Operator attached `https://simak.ansyar-world.top` to the Coolify application on port `3000`, verified the certificate after deployment, and confirmed HTTP redirects to HTTPS.
- [x] Task: Perform the initial application deployment [7b0f76f]
  - [x] Verify migrations complete through the bundled, advisory-locked migration runner.
  - [x] Verify the container becomes healthy through `/api/health`.
  - [x] Run the idempotent seed runner once through Coolify to create the initial SuperAdmin.
  - Initial deployment from `afb3d53d` reached and completed migrations but failed because the build lacked a Nitro Node-server output. Although the Vite build also emitted `dist/server/server.js`, that artifact is not the standalone Docker listener. The official TanStack Vite/Docker configuration now applies the `nitro()` plugin; validated remediation `66797bbc` emits `.output/server/index.mjs`, preserves the migration/seed runners, and has been pushed for redeployment.
  - Operator confirmed a healthy `/api/health` response with database, R2, and email-queue checks passing; the one-time seed completed, SuperAdmin login succeeded, and Analytics loaded successfully after the deployed query repair.
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`) [210f924]

## Phase 3: Recovery, Operations & Runbooks

- [x] Task: Configure PostgreSQL backup retention in Coolify [dc47411]
  - Operator configured daily PostgreSQL backups with 7 retained copies for `simak-postgres`.
  - Backups are stored on both Coolify server storage and remote S3-compatible storage; database persistence and private networking remain enabled.
- [x] Task: Test and record the database restore procedure in a non-production target. [8969d70]
  - Operator restored the latest local Coolify backup into an isolated non-production target and verified connectivity, SIMAK schema/migration state, and representative data.
  - The temporary target was removed after verification; the backup timestamp and target name were intentionally kept out of repository documentation.
- [x] Task: Write the deployment operations runbook [2dd34e6]
  - [x] Harden the production seed entry point so direct execution seeds only the SuperAdmin [0b53ec7]
    - Direct `node .output/server/seed.mjs` execution now runs only `runProductionSeed()`; test fixture helpers remain available to dedicated test setup.
  - [x] Document environment-variable inventory without secret values.
  - [x] Document deployment, health/log inspection, migration failure handling, backup/restore, and rollback procedures.
  - [x] Document the one-time SuperAdmin bootstrap command and expected outcome.
  - Runbook: `docs/deployment-runbook.md`.
  - Quality gates: typecheck passed; lint passed with 4 pre-existing warnings and 0 errors; coverage passed with 388 files and 3,953 tests, exceeding all 80% thresholds.
- [x] Task: Link the runbook from the project README. [1430db2]
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`) [efcc719]
  - Automated verification passed: `pnpm typecheck`; `pnpm lint` (0 errors, 4 pre-existing warnings); `CI=true pnpm test:coverage` (3,953 tests, all coverage thresholds passed); `git diff --check`.
  - Manual verification: Operator confirmed on 2026-08-01 that the README link and runbook match the confirmed Coolify setup, including direct PostgreSQL/no PgBouncer, daily seven-copy local and remote backups, the completed isolated restore drill and cleanup, and the SuperAdmin-only seed command.
  - Phase 3 outcome: Operations runbook, README link, production seed hardening, backup retention, and restore evidence are complete. Production smoke tests remain in Phase 4.

## Phase 4: Private-Pilot Verification & Handover

- [x] Task: Execute production smoke tests
  - [x] Fix production CSP `connect-src` to allow the R2 bucket subdomain used by presigned upload URLs [381f1ac]
    - `buildSecurityHeaders` now allows the HTTPS R2 endpoint and HTTPS bucket subdomains; targeted red/green test coverage passed (26 tests).
  - [x] Configure the production R2 bucket CORS policy for browser presigned uploads [0a3762d]
    - Operator configured the production origin-specific R2 CORS policy; the browser preflight and disposable upload then passed.
  - [x] Fix production CSP `object-src` to allow the R2 PDF preview while retaining source restrictions [32215a3]
    - `object-src` now allows only the configured HTTPS R2 endpoint and bucket subdomains; it remains `object-src 'none'` when R2 is not configured. Targeted red/green coverage passed with 26 tests; the deployed PDF preview subsequently rendered successfully.
  - [x] Fix production CSP `frame-src` to allow the R2 PDF preview while retaining source restrictions [78dc3c4]
    - `frame-src` now allows only the configured HTTPS R2 endpoint and bucket subdomains alongside `'self'`. Targeted red/green coverage passed with 26 tests; the deployed PDF preview subsequently rendered successfully.
  - [x] Verify HTTPS, `/api/health`, and expected security headers.
    - Public verification returned HTTP 200 with healthy database, R2, and email queue checks. The deployed response included the R2 `connect-src`, `frame-src`, and `object-src` sources, HSTS, frame protection, `nosniff`, strict referrer policy, and restrictive permissions policy.
  - [x] Verify SuperAdmin, Admin, Instructor, and Student authentication and authorization paths.
    - Operator confirmed all four role login and role-bound route checks passed, including denied-route behavior.
  - [x] Verify invitation/password setup email delivery through Resend.
    - Operator confirmed invitation delivery, first-time password setup, login, and setup-token non-reuse passed.
  - [x] Verify an R2 upload, download, and permission-restricted access path.
    - Operator confirmed the disposable browser upload, PDF preview, authorized download, and non-owner access denial passed after the production R2 CORS/CSP fixes.
  - [x] Verify a minimal assignment lifecycle: assignment creation, submission, and review.
    - Operator confirmed assignment creation, Student submission, Instructor review/decision, resulting status, and notification passed.
- [x] Task: Verify Coolify logs contain structured operational output and no secrets.
  - Operator reviewed recent Coolify application logs after the final deployment and confirmed structured operational entries with no database/auth/R2/email secrets or signed URLs.
- [x] Task: Record pilot deployment details, known operational limits, and rollback readiness in the runbook [2dd34e6]
  - `docs/deployment-runbook.md` records the `simak-private-pilot`/`production` Coolify topology, `track-047/coolify-private-pilot-deployment` deployment branch, port 3000 health contract, direct PostgreSQL/no-PgBouncer operation, R2/Resend dependencies, daily seven-copy local and remote backups, restore evidence, rollback procedures, and single-instance pilot limits.
  - The runbook also records the final smoke-test handover: health/security checks, role access, invitation setup, R2 upload/download/authorization, assignment lifecycle, and secret-free structured-log verification.
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`)
  - Automated verification: latest pre-push gate passed 388 test files and 3,953 tests, typecheck, and coverage (89.39% statements, 81.08% branches, 83.55% functions, 90.13% lines). Public `/api/health` returned HTTP 200 with healthy database, R2, and email queue checks; live HTTPS security headers and R2 CSP sources were present.
  - Manual verification: Operator confirmed on 2026-08-01 that role authentication/authorization, invitation/password setup, R2 upload/CORS, PDF preview, authorized download, non-owner denial, assignment lifecycle, and secret-free structured logs all passed.
  - Handover confirmation: Operator confirmed the Phase 4 production smoke tests and runbook handover were complete.
</protect>
