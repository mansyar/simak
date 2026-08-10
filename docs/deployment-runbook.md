# SIMAK Coolify Deployment Runbook

This runbook covers the single-instance SIMAK private pilot. It describes the
configuration verified for TRACK-047; it is not a guide for multi-instance
deployment, Redis, horizontal scaling, or CI/CD outside Coolify.

## Current pilot topology

| Component | Configuration |
| --- | --- |
| Coolify project/environment | `simak-private-pilot` / `production` |
| Application source | `track-047/coolify-private-pilot-deployment` |
| Build | `docker/Dockerfile`, port `3000` |
| Database | Coolify-managed PostgreSQL 16 service `simak-postgres` |
| Database network | Private application-to-database network; no public database exposure |
| Application URL | `https://simak.ansyar-world.top` |
| TLS | Coolify/Traefik certificate with HTTP redirected to HTTPS |
| File storage | Private Cloudflare R2 bucket via presigned URLs |
| Email | Resend transactional email and background queue |
| Backups | Daily, seven retained copies, stored in both Coolify server storage and remote S3-compatible storage |
| Scaling | One application instance; no Redis or horizontal scaling |

The application connects directly to PostgreSQL in this pilot. PgBouncer is
not used, so `DB_PREPARED_STATEMENTS_DISABLED` remains unset (or `false`).
Some general architecture documents describe an optional PgBouncer topology;
do not apply that topology to this pilot without an approved change.

## Safety rules

- Keep all secret values in Coolify runtime environment configuration. Never
  commit, paste into this runbook, or print values from `DATABASE_URL`, R2,
  Resend, Better Auth, or SuperAdmin credentials.
- Take or verify a recent database backup before a deployment that changes
  migrations or runtime behavior.
- Do not run `drizzle-kit push` against the pilot database.
- Do not restore a backup over `simak-postgres` as a first test. Restore into
  an isolated non-production target first.
- Database restoration, migration rollback, and credential rotation are
  operator procedures—not application-admin actions.
- Treat Coolify deployment logs as sensitive operational output. Redact
  connection strings, tokens, passwords, and access keys from incident reports.

## Runtime environment inventory

Configure these names in Coolify without recording their values here.

| Variable | Requirement and purpose |
| --- | --- |
| `DATABASE_URL` | Required. Direct private PostgreSQL connection used by the application. |
| `MIGRATE_DATABASE_URL` | Required for this pilot's migration procedure. Direct PostgreSQL connection used by the bundled migration runner; falls back to `DATABASE_URL` if absent. |
| `R2_ENDPOINT` | Required for production file uploads; private Cloudflare R2 endpoint. |
| `R2_ACCESS_KEY_ID` | Required for the scoped R2 service credential. |
| `R2_SECRET_ACCESS_KEY` | Required for the scoped R2 service credential. |
| `R2_BUCKET_NAME` | Required for the private application-upload bucket. |
| `R2_PUBLIC_URL` | Leave unset to keep the bucket private unless a separately approved public custom domain is introduced. |
| `RESEND_API_KEY` | Required for transactional email. |
| `EMAIL_FROM` | Configure explicitly for the pilot and verify it in Resend; the code default is `SIMAK <noreply@simak.app>` and must not be assumed verified. |
| `BETTER_AUTH_SECRET` | Required signing secret; keep it masked and rotate through the incident procedure. |
| `BETTER_AUTH_URL` | Required public application URL; must match the HTTPS pilot domain. |
| `SUPERADMIN_EMAIL` | Required one-time bootstrap identity. |
| `SUPERADMIN_PASSWORD` | Required one-time bootstrap password; never place it in a command argument or log. |
| `LOG_LEVEL` | Optional; defaults to `info`. Use the least verbose level needed for an incident. |
| `DB_POOL_MAX` | Optional; defaults to `10`. Change only with a measured capacity reason. |
| `DB_PREPARED_STATEMENTS_DISABLED` | Leave unset/`false` because PgBouncer is not used. Set `true` only with an approved PgBouncer deployment. |
| `SHUTDOWN_TIMEOUT_MS` | Optional; defaults to `10000`. Controls graceful shutdown drain time. |

After saving variables, confirm that Coolify displays them as masked runtime
values and that no value appears in repository files, build output, or logs.

## R2 browser CORS policy

Uploads use browser-direct presigned `PUT` requests. R2 must therefore allow the
production origin and the request headers used by the uploader; setting the R2
environment variables alone is not sufficient. Configure the application-upload
bucket in Cloudflare R2 **Settings → CORS policy** with an origin-specific policy
like this:

```json
[
  {
    "AllowedOrigins": ["https://simak.ansyar-world.top"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not use `*` for the production origin. Add a localhost origin only to a
deliberately shared development bucket/policy. After saving the policy, verify
that the browser's preflight `OPTIONS` response includes
`Access-Control-Allow-Origin` and allows `PUT`/`Content-Type`; the subsequent
presigned `PUT` should return a successful response. Never paste a signed URL
or its query string into an issue, commit, or operator log.

## R2 object lifecycle (reports/ prefix)

Report PDFs are stored under the `reports/` key prefix with opaque UUID names
(e.g. `reports/4f3a….pdf`) and are **never** served through a public URL;
downloads use short-lived presigned GET URLs only. Deletion of report objects
is driven by the application's expiry cleanup (`report_expiry_cleanup` audit
events), which only knows keys still attached to database report jobs.

The application cannot discover orphaned objects: if the server crashes between
uploading a report to R2 and recording the artifact on its job row, or if a job
row is deleted while the object still exists, the key is unrecoverable from the
database and no application process can clean it up.

> **Required: configure an R2 lifecycle rule for the `reports/` prefix.**
> In Cloudflare R2 **Bucket → Settings → Lifecycle rules**, add a rule that
> **deletes objects with prefix `reports/` after 40 days**. The application
> already deletes objects at 30-day job expiry (plus a short grace for in-flight
> expiry runs); 40 days is strictly longer, so legitimate reports are deleted by
> the application first and the rule only sweeps orphans left by crashes or
> manual database edits. Verify the rule after configuration and record it in
> the deployment ticket. Until this rule exists, a crash between upload and
> completion leaves an orphaned report object in the bucket indefinitely.

Do not apply the rule to other prefixes (`submissions/` has a separate
retention policy and must be reviewed independently before any lifecycle rule
touches it).

## Pre-deployment checklist

1. Confirm the intended repository branch and commit in Coolify. Record the
   commit SHA in the deployment ticket or operator log.
2. Confirm the image is built from `docker/Dockerfile` with port `3000` and
   the `/api/health` probe.
3. Run the repository quality gates for a new release:

   ```bash
   CI=true pnpm test:coverage
   pnpm typecheck
   pnpm lint
   ```

4. Confirm the latest scheduled PostgreSQL backup succeeded and the persistent
   database volume is attached.
5. Confirm `MIGRATE_DATABASE_URL` reaches PostgreSQL directly and that no
   PgBouncer-specific setting has been enabled accidentally.
6. Confirm R2 bucket CORS, scoped credentials, and the Resend sender/domain
   are ready for the release.
7. Confirm the R2 lifecycle rule for the `reports/` prefix (see
   "R2 object lifecycle (reports/ prefix)") exists and is verified.
8. Confirm DNS still points the pilot domain to the Coolify ingress and the
   certificate is valid.

## Deploy or redeploy

1. Open the `simak-private-pilot` project and `production` environment in
   Coolify.
2. Review the pending commit and runtime variable names. Do not expose secret
   values while reviewing the deployment.
3. Start a deployment from the application service. Do not add a second
   PostgreSQL service or a migration sidecar.
4. Watch the deployment logs. The image contains
   `.output/server/index.mjs`, `.output/server/migrate.mjs`,
   `.output/server/seed.mjs`, and `drizzle/migrations/`.
5. The current image starts `/app/start.sh`. The wrapper runs the migration runner
   before the application and uses `exec` for correct signal delivery:

   ```text
   /app/start.sh
   ```

   The migration runner acquires PostgreSQL advisory lock `789123`, applies
   pending migrations from `./drizzle/migrations`, releases the lock, and
   exits non-zero on failure. Because the command uses `&&`, the application
   does not start after a failed migration.
6. Look for the expected migration sequence in the deployment output:
   `Acquiring advisory lock...`, `Running migrations...`, `Migrations complete.`,
   and `Releasing advisory lock...`.
7. After the container is healthy, run the health and smoke checks below. Do
   not run the seed command on every deployment.

If a new container fails during migration or health checks, inspect the
deployment logs and verify whether the previous healthy release is still
serving. Do not assume an application rollback reverses database migrations.
Follow [Migration failure and rollback](#migration-failure-and-rollback).

## One-time SuperAdmin bootstrap

Run this only after the first deployment has completed migrations and passed
`/api/health`, using the Coolify service terminal with the runtime environment
attached:

```bash
node .output/server/seed.mjs
```

The direct production entry point is intentionally restricted to the
SuperAdmin bootstrap. On the first run, expect a `SuperAdmin user created`
message; on a repeat run, expect `SuperAdmin user already exists ...` and no
duplicate account. The command reads `SUPERADMIN_EMAIL` and
`SUPERADMIN_PASSWORD` from the masked runtime environment.

This behavior requires an image built from the seed-safety fix in commit
`0b53ec7` or a later descendant. Do not run the command from an older image:
older bundles also executed development test-fixture seeders and could print a
test password. If the old bundle was already run, review its test-fixture rows
before onboarding real pilot data and treat any exposed credential as needing
rotation.

The exported test seed helpers are for isolated test setup only; they must not
be run against the pilot database.

## Health and deployment verification

The public endpoint is unauthenticated and intentionally returns generic error
messages. It performs database connectivity, R2 reachability, and informational
email-queue depth checks, each with a two-second timeout.

The image-level Docker healthcheck uses BusyBox `wget` against the IPv4 loopback
address (`http://127.0.0.1:3000/api/health`) to avoid Alpine `localhost` resolution
ambiguity. The public check below validates the same application endpoint through
Coolify's HTTPS ingress.

From an operator workstation:

```bash
curl --fail --silent --show-error --include \
  https://simak.ansyar-world.top/api/health
```

Expected result is HTTP `200` and JSON similar to:

```json
{
  "status": "healthy",
  "timestamp": "<ISO 8601>",
  "version": "<package version>",
  "checks": {
    "database": { "status": "ok" },
    "r2": { "status": "ok" },
    "emailQueue": { "status": "ok", "depth": 0 }
  }
}
```

`r2.status` may be `not_configured` in an environment where R2 is deliberately
absent. A configured but unreachable R2 or an unreachable database returns
HTTP `503`; do not bypass that failure by disabling the health probe.

Check the response headers as well:

```bash
curl --silent --show-error --max-time 10 --output /dev/null --dump-header - http://simak.ansyar-world.top/
curl --silent --show-error --head https://simak.ansyar-world.top/
```

Confirm the first command returns a `301` or `308` with a `Location` pointing to
the HTTPS origin. Confirm the second command returns HTTP `200` over HTTPS with
`X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, the expected referrer and permissions
policies, and production HSTS.

Then verify, without recording credentials:

- SuperAdmin login succeeds and an unauthenticated visitor is redirected to
  the login page.
- An invited user can receive the setup-password email through Resend.
- Admin, instructor, and student routes enforce their role guards.
- A representative R2 upload and download succeeds through presigned URLs;
  an unauthorized user cannot access another user's object.
- A minimal assignment, submission, and review flow succeeds.
- The email queue does not grow unexpectedly after the smoke flow.

## Log inspection

Coolify captures application stdout/stderr. Application server logs use pino
structured output in production; migration and seed runners also emit short
plain-text lifecycle messages. Inspect logs in Coolify after every deployment
and during incidents.

Look for:

- deployment commit and container start time;
- migration completion or a clearly reported migration failure;
- `requestId` on server-function errors and background-job events;
- `advisory_failed`, email queue, deadline scanner, or R2 cleanup failures;
- graceful shutdown and background-processor drain messages.

Confirm that logs contain neither secret values nor full connection strings.
Do not paste raw logs into tickets; redact email addresses and user data when
they are not needed for diagnosis.

## Backup and restore

The configured private-pilot policy is daily backups with seven retained
copies, stored both on Coolify server storage and remote S3-compatible storage.
The completed [TRACK-048 backup and restore readiness review](backup-restore-readiness.md)
confirms this pilot baseline and records follow-up gaps without changing the
configuration. Retention expansion, an independent scheduler, job-level failure
alerting, separate backup credentials, and expanded R2 durability remain
recommendations rather than implemented controls.
Confirm that the remote destination remains accessible and that local disk
capacity is sufficient. The retention count is an operational pilot setting;
change it only with an approved backup-policy update.

### Restore drill

The validated drill restored the latest local Coolify backup into an isolated
non-production PostgreSQL target, verified connectivity, SIMAK schema/migration
state, and representative data, and removed the temporary target afterward.
The backup timestamp and target name are intentionally not stored in this
repository.

Repeat the drill when the backup destination, PostgreSQL version, or restore
procedure changes:

1. Create a temporary PostgreSQL 16 target with persistent storage and private
   networking. Do not reuse `simak-postgres`.
2. Select a retained backup and record its timestamp in the operator ticket.
3. Restore it through the Coolify backup interface into the temporary target.
4. Verify a private connection, the `__drizzle_migrations` state, representative
   application tables, and expected row relationships. Do not copy secrets or
   real user data into tickets.
5. If a restored application is attached for testing, use non-production
   runtime credentials and a non-production R2/email configuration.
6. Record success or failure, elapsed restore time, and the backup source.
7. Delete the temporary target after verification unless it is explicitly kept
   for a documented follow-up.

For a real recovery, first stop or isolate writes, preserve the latest usable
backup, and obtain operator approval before replacing the production database.
Never validate a restore by overwriting the only live copy.

## Migration failure and rollback

### Migration failure

1. Stop repeated redeploy attempts and capture the sanitized deployment log.
2. Confirm whether the migration acquired the advisory lock and whether it
   reported a completed migration or an error.
3. Verify whether the previous healthy application release is still serving.
4. Take a fresh backup before any corrective database operation.
5. Prefer a forward-compatible migration fix and a new image. Do not edit the
   migration journal or use `drizzle-kit push` in production.
6. If a rollback is unavoidable, test the matching companion SQL file against
   an isolated restore first. Rollback files are manual and may be destructive;
   they are never applied automatically by the application.

### Application rollback

1. Stop new deployments and record the failing commit and the last healthy
   commit from Coolify deployment history.
2. Use Coolify's deployment history to redeploy the last healthy application
   commit, without changing database runtime values.
3. Verify the health endpoint, logs, authentication, and the affected core
   flow.
4. If the failed release applied a schema migration, confirm that the previous
   application is compatible with that schema before serving traffic. A code
   rollback alone does not undo a migration.

### Database rollback

1. Take and verify a fresh backup; establish a maintenance window.
2. Identify the exact forward migration and its companion file under
   `drizzle/migrations/rollback/`.
3. Restore that backup into an isolated target and execute the rollback there
   first with a private PostgreSQL client.
4. Review data-loss notes and dependency order in the rollback SQL. Obtain
   explicit operator approval before production execution.
5. Execute the approved SQL against the private production database, then
   verify migration state, `/api/health`, and critical flows. Reconcile
   `__drizzle_migrations` before restarting the application: after a successful
   manual rollback, remove only the exact rolled-back migration row when it is
   the latest applied migration and the companion SQL fully reverses it; never
   edit hashes or delete an earlier row. If the migration is not the latest, or
   the rollback is partial/data-destructive, restore the isolated backup instead
   of editing the journal. Run the migration bundle once after reconciliation
   and confirm the journal matches the deployed migration files.
6. Record the action, operator, backup, migration, journal reconciliation,
   outcome, and follow-up fix
   without recording credentials or raw personal data.

## Incident handover checklist

Record these items in the private operations ticket:

- deployment commit, timestamp, and Coolify environment;
- backup source/timestamp and restore-test result;
- health response status and failing check, if any;
- sanitized log excerpts with request IDs where useful;
- whether the application or database was rolled back;
- remaining operational limits: one instance, no Redis, no external monitoring,
  and manual rollback/restore procedures.
