# Backup & Restore Readiness Review

## Purpose and authority

This document records the TRACK-048 review of SIMAK's private-pilot backup and
restore posture before wider production use. It is a documentation-only
assessment based on the completed TRACK-047 evidence and the operational
runbook; it does not change the pilot configuration.

The authoritative references are:

- [TRACK-047 specification](../conductor/archive/coolify-private-pilot-deployment_20260731/spec.md)
- [TRACK-047 implementation plan](../conductor/archive/coolify-private-pilot-deployment_20260731/plan.md)
- [Coolify deployment runbook](deployment-runbook.md)
- [README deployment baseline](../README.md#deployment)

TRACK-047 evidence remains the source for the current backup and restore
baseline. No fresh production backup or restore drill is performed or implied
by this review. Sensitive backup timestamps, temporary restore-target names,
credentials, signed URLs, and other operational identifiers are intentionally
omitted.

Status labels used below:

- **Current** — established by the pilot evidence or runbook.
- **Partially addressed** — a useful control or evidence exists, but its
  production-readiness boundary is incomplete.
- **Deferred** — intentionally not implemented or validated in this track.
- **Follow-up decision** — an owner must decide whether and how to pursue the
  gap before a future implementation track.

## Verified private-pilot baseline

| Area | Verified current state | Status and boundary |
| --- | --- | --- |
| PostgreSQL backups | The Coolify-managed PostgreSQL 16 service is backed up daily, with seven retained copies. | **Current.** The seven-copy setting is the pilot baseline, not a broader retention commitment. |
| Backup destinations | Copies are stored in Coolify server storage and remote S3-compatible storage. | **Current.** Destination names, credentials, and exact object identifiers are not recorded here. |
| Restore evidence | TRACK-047 restored a recent local backup into an isolated non-production target and verified connectivity, migration/schema state, and representative data. The temporary target was removed afterward. | **Partially addressed.** The procedure has evidence, but this review does not create a new drill or claim recurring evidence beyond the documented procedure. |
| Restore authority | Restoration is an operator-only procedure. The first restore test must use an isolated non-production target rather than the pilot database. | **Current.** No user-facing restore workflow is introduced. |
| Pilot topology | The deployment is a private, single-instance Coolify pilot with a private PostgreSQL network and no public database exposure. | **Current.** High-availability, multi-instance, and cross-region operation are outside this review. |
| Application file storage | The application uses a private Cloudflare R2 bucket through presigned URLs. | **Current.** This does not assert that R2 versioning, retention, replication, or recovery features are enabled. |
| Secret handling | Secret values remain in Coolify runtime configuration; repository documentation records variable names and procedures, not values. | **Partially addressed.** The specific least-privilege separation of backup access still needs an operational review. |

## Restore operating boundary

The existing operator procedure is intentionally conservative:

1. Verify that a suitable backup exists before a migration or other operation
   that could affect database recovery.
2. Restore into an isolated non-production destination first. Never overwrite
   the pilot database as the first restore test.
3. Verify database connectivity, SIMAK migration/schema state, and
   representative data.
4. Remove the temporary destination after the drill and keep sensitive target
   details out of repository documentation and incident reports.
5. Treat restoration, migration rollback, and credential rotation as operator
   procedures rather than application-admin actions.

This review preserves that boundary. It does not authorize a production
restore, add a restore UI, or grant the application access to backup controls.

## Current-state gap analysis

### Retention duration and policy ownership

**Status: Follow-up decision.**

The verified configuration retains seven daily copies in two storage locations.
The evidence does not establish an approved business retention duration beyond
that pilot setting, a recovery-point/recovery-time objective, or a named owner
responsible for approving future retention changes. The seven-copy setting
must therefore remain described as the current pilot configuration rather than
as an approved long-term policy.

No retention change is made by TRACK-048.

### Scheduler independence

**Status: Partially addressed.**

The backup schedule is managed by Coolify rather than by application code, so
the application runtime is not being changed to run backups. The evidence does
not establish an independent second scheduler, an alternate control plane, or
a tested fallback if the hosting control plane cannot run the job. Whether
that additional independence is necessary depends on the future recovery
objectives and operational risk decision.

No independent scheduler is added by TRACK-048.

### Job-level success/failure visibility and alerting

**Status: Deferred.**

The runbook instructs operators to verify the latest scheduled backup and to
inspect sensitive Coolify logs during operations. TRACK-047 does not establish
repository-managed job-level success/failure metrics, alert routing,
escalation ownership, or a tested notification path for missed or failed
backups. Application health and deployment logs must not be treated as proof
that a scheduled backup completed successfully.

No monitoring, alerting, or backup job change is made by TRACK-048.

### Restore reproducibility and evidence maintenance

**Status: Partially addressed.**

The isolated restore drill verified connectivity, migration/schema state, and
representative data, and the runbook records an operator-only restore-first
procedure. The runbook also calls for repeating restore drills when the
destination, database version, or procedure changes. A future owner still
needs to decide how drill evidence, success criteria, and follow-up actions are
maintained between such changes without exposing sensitive target details.

No fresh production or non-production drill is performed by TRACK-048.

### Backup credential isolation

**Status: Follow-up decision.**

The repository evidence confirms that secret values are kept in Coolify and
that application R2 credentials are handled as private runtime configuration.
It does not independently demonstrate the scope, rotation ownership, or
separation of any credentials used by the backup destinations. A future
implementation must verify that the normal application runtime cannot read or
use backup-storage credentials and that operators receive only the access
needed for the documented procedure.

No credential rotation or access-policy change is made by TRACK-048.

### R2 durability, versioning, and recovery

**Status: Follow-up decision.**

The current pilot uses private R2 storage for uploaded application files and
presigned access. TRACK-047 evidence does not establish an R2 versioning,
retention, replication, or object-recovery policy. PostgreSQL backup copies in
Coolify and remote S3-compatible storage should not be confused with recovery
of uploaded R2 files. A future review should determine whether the application's
data-loss risk and recovery objectives justify validating or changing an R2
durability feature.

No R2 versioning, retention, replication, or recovery configuration is changed
by TRACK-048.

## Review guardrails

The following distinctions are mandatory for the remainder of this track:

- The daily seven-copy local-plus-remote PostgreSQL configuration is the only
  implemented backup baseline being documented.
- Retention expansion, an independent scheduler, failure alerting, separate
  backup credentials, and expanded R2 durability controls are future topics,
  not implemented configuration.
- Restore remains operator-only and isolated-first.
- No secrets, signed URLs, credentials, exact temporary target identifiers, or
  sensitive backup timestamps belong in repository documentation.
- No application code, schema, runtime behavior, deployment topology, or
  backup configuration is changed by this review.
