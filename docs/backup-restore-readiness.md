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

## Prioritized future recommendations

These recommendations are the output of the gap analysis. They are options for
future approval, not implemented configuration. A future implementation track
must confirm its scope, owner, and verification evidence before changing the
seven-copy pilot baseline.

### 1. Approve recovery objectives and a retention policy

- **Priority:** P0 — decision required before wider production use.
- **Recommendation:** Assign an owner for recovery objectives and approve a
  retention policy that explains how many recovery points are needed and for
  how long. Keep the existing seven daily copies unchanged until that decision
  is approved.
- **Options:** Continue the seven-copy pilot setting; adopt a time-based window
  such as a 30-day logical-backup policy; or adopt a tiered daily/weekly/monthly
  policy. The latter options are examples for decision-making, not current
  SIMAK configuration.
- **Operational owner:** Infrastructure/data owner with product or compliance
  input where required.
- **Prerequisites:** Documented recovery-point and recovery-time objectives,
  data classification, storage-cost estimate, and an approved retention owner.
- **Risk:** A longer window increases storage and governance cost; an
  unreviewed shorter window may leave insufficient recovery history.
- **Implementation status:** Proposed; no retention policy change is included
  in TRACK-048.

### 2. Decide whether the Coolify scheduler is independent enough

- **Priority:** P1 — evaluate with the recovery-objectives decision.
- **Recommendation:** Treat the current Coolify-managed schedule as the pilot
  mechanism and decide whether a separate managed scheduler or control plane is
  justified. Do not move scheduling into the application process by default;
  that would couple backup execution to application runtime health.
- **Options:** Keep Coolify scheduling; use an external managed scheduler with
  an authenticated backup operation; or use a second control plane only when a
  defined failure model shows that it is necessary. A second scheduler must not
  create duplicate or conflicting jobs.
- **Operational owner:** Infrastructure operations.
- **Prerequisites:** Failure-model review, recovery objectives, provider
  capability review, ownership of the schedule, and an idempotency/duplicate-job
  plan.
- **Risk:** Additional schedulers increase cost and operational complexity;
  duplicated jobs can increase load or create misleading success signals.
- **Implementation status:** Proposed; no independent scheduler is added by
  TRACK-048.

### 3. Add job-level backup success and failure visibility

- **Priority:** P0 — establish before relying on backups for a wider rollout.
- **Recommendation:** For any future backup-job implementation, capture and
  review sanitized evidence for the schedule, start and finish, success or
  failure, each configured destination, retention result, failure reason, and
  operator acknowledgement. Alert on a failed job, a missed expected job, or a
  stale last-success signal, with a documented escalation owner.
- **Operational owner:** Infrastructure operations, with the incident owner
  responsible for escalation routing.
- **Prerequisites:** An approved alert channel, job identifiers that do not
  expose secrets, a freshness threshold, escalation ownership, and a test
  failure or notification path.
- **Risk:** Noisy alerts can be ignored; poorly redacted diagnostics can expose
  connection strings, access keys, or signed URLs.
- **Implementation status:** Deferred; TRACK-048 adds no monitoring or alerting.

### 4. Maintain reproducible, sanitized restore evidence

- **Priority:** P1 — maintain alongside database-version or procedure changes.
- **Recommendation:** Keep the existing isolated-restore-first procedure as the
  operator boundary. When the destination, database version, or procedure
  changes, record a sanitized drill result covering connectivity,
  migration/schema state, representative data, cleanup, and follow-up actions.
  Do not record temporary target names, exact backup timestamps, or credentials.
- **Operational owner:** Database/infrastructure operator.
- **Prerequisites:** An isolated non-production destination, a representative
  validation dataset, a version-aware checklist, an evidence owner, and a safe
  cleanup procedure.
- **Risk:** A stale or overly narrow drill can create false confidence; an
  unsafe destination can affect production data.
- **Implementation status:** Partially addressed by TRACK-047 evidence;
  maintenance of future evidence is recommended but no new drill is performed
  by TRACK-048.

### 5. Verify least-privilege backup credential isolation

- **Priority:** P0 — verify before expanding operational access.
- **Recommendation:** Audit the identities used by Coolify and each backup
  destination. Scope them to the required backup, list, retention, and restore
  operations; keep them separate from application runtime credentials; define
  rotation ownership; and test that the normal application runtime cannot read
  or use backup-storage credentials.
- **Operational owner:** Infrastructure and security operations.
- **Prerequisites:** Provider IAM capability, an inventory of backup and R2
  identities, an approved rotation procedure, break-glass access rules, and
  redacted access-test evidence.
- **Risk:** Overly broad access increases data-exfiltration impact; overly
  narrow access can make backup or restore fail during an incident.
- **Implementation status:** Proposed; TRACK-048 changes no credentials or
  access policies.

### 6. Review R2 durability and recovery only against a defined need

- **Priority:** P1 — follow up when object-recovery objectives or risk review
  justify it.
- **Recommendation:** Validate the current private R2 bucket posture against
  uploaded-file recovery objectives. Compare leaving the current policy as-is
  with provider-supported versioning, retention, or replication controls. Add
  a control only after its deletion/recovery behavior, cost, access impact, and
  operational owner are approved.
- **Operational owner:** Infrastructure/storage owner with security and product
  risk input.
- **Prerequisites:** Uploaded-file data classification, object recovery
  objectives, provider/account configuration review, cost assessment, and a
  recovery test plan that does not expose signed URLs.
- **Risk:** Retention or replication can increase cost and complicate deletion
  obligations; assuming a durability feature exists can create false recovery
  confidence.
- **Implementation status:** Deferred follow-up decision; TRACK-048 makes no
  R2 versioning, retention, replication, or recovery configuration change.

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
