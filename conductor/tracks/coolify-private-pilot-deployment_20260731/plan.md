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
  - Coolify-only configuration inventory: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, and all five R2 values (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`). Optional runtime settings are `LOG_LEVEL`, `DB_POOL_MAX`, and `SHUTDOWN_TIMEOUT_MS`; set `DB_PREPARED_STATEMENTS_DISABLED=true` only when PgBouncer is used.
  - Keep all secret values in Coolify, prepare a backup before the first migration, and run `node .output/server/seed.mjs` once only after the initial deployment is healthy.
- [x] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`) [01bedac]

## Phase 1: Provision Coolify Pilot Infrastructure

- [x] Task: Create the isolated Coolify project and environment for the private pilot [a005a21]
  - Coolify project `simak-private-pilot` and environment `production` created by the operator; no application or database has been added yet.
- [~] Task: Provision a Coolify-managed PostgreSQL 16 service
  - [x] Enable persistent database storage.
  - [x] Generate and store unique database credentials exclusively in Coolify.
  - [x] Restrict database networking to the application service.
  - Operator confirmed `simak-postgres` (PostgreSQL 16, database `simak`) is running and healthy with generated credentials and no public exposure.
- [ ] Task: Create the SIMAK application service from the repository Dockerfile
  - [ ] Configure the production build context and `docker/Dockerfile`.
  - [ ] Configure the container port and `/api/health` health probe.
  - [ ] Configure restart and deployment behavior appropriate for a single-instance pilot.
- [ ] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`)

## Phase 2: Configure Production Runtime & First Release

- [ ] Task: Configure the complete production environment in Coolify
  - [ ] Set `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `BETTER_AUTH_URL`, authentication secrets, Resend, R2, SuperAdmin, logging, and pool settings.
  - [ ] Ensure `MIGRATE_DATABASE_URL` reaches PostgreSQL directly and set `DB_PREPARED_STATEMENTS_DISABLED` only if PgBouncer is enabled.
  - [ ] Verify no secrets appear in Git, application logs, or documentation.
- [ ] Task: Configure the custom pilot domain and TLS
  - [ ] Point DNS to the VPS/Coolify ingress.
  - [ ] Attach the domain in Coolify and verify a valid certificate.
  - [ ] Confirm HTTP redirects to HTTPS.
- [ ] Task: Perform the initial application deployment
  - [ ] Verify migrations complete through the bundled, advisory-locked migration runner.
  - [ ] Verify the container becomes healthy through `/api/health`.
  - [ ] Run the idempotent seed runner once through Coolify to create the initial SuperAdmin.
- [ ] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`)

## Phase 3: Recovery, Operations & Runbooks

- [ ] Task: Configure PostgreSQL backup retention in Coolify.
- [ ] Task: Test and record the database restore procedure in a non-production target.
- [ ] Task: Write the deployment operations runbook
  - [ ] Document environment-variable inventory without secret values.
  - [ ] Document deployment, health/log inspection, migration failure handling, backup/restore, and rollback procedures.
  - [ ] Document the one-time SuperAdmin bootstrap command and expected outcome.
- [ ] Task: Link the runbook from the project README.
- [ ] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`)

## Phase 4: Private-Pilot Verification & Handover

- [ ] Task: Execute production smoke tests
  - [ ] Verify HTTPS, `/api/health`, and expected security headers.
  - [ ] Verify SuperAdmin, Admin, Instructor, and Student authentication and authorization paths.
  - [ ] Verify invitation/password setup email delivery through Resend.
  - [ ] Verify an R2 upload, download, and permission-restricted access path.
  - [ ] Verify a minimal assignment lifecycle: assignment creation, submission, and review.
- [ ] Task: Verify Coolify logs contain structured operational output and no secrets.
- [ ] Task: Record pilot deployment details, known operational limits, and rollback readiness in the runbook.
- [ ] Task: Phase Verification & Checkpoint (refer to `conductor/workflow.md`)
</protect>
