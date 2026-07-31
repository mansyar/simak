<protect>
# Specification: TRACK-048 — Backup & Restore Readiness

## Track Type

Chore / Infrastructure

## Overview

Document and assess SIMAK’s current private-pilot backup and restore posture before wider production use. The review will use the completed TRACK-047 deployment evidence as its source, preserve the existing seven-copy pilot baseline, identify operational gaps, and recommend prioritized follow-up work without implementing new backup infrastructure.

## Current Baseline

TRACK-047 established:

- Daily PostgreSQL backups for the Coolify-managed database.
- Seven retained backup copies.
- Storage on both Coolify server storage and remote S3-compatible storage.
- An isolated restore drill that verified connectivity, schema/migration state, and representative data.
- An operator-only restore procedure documented in `docs/deployment-runbook.md`.
- A private R2 bucket used by the application.

These facts must remain clearly distinguished from proposed future improvements.

## Functional Requirements

1. **Record the current state**
   - Consolidate the verified TRACK-047 backup, restore, and storage evidence.
   - Link to the TRACK-047 archive and `docs/deployment-runbook.md`.
   - Do not include secrets, signed URLs, backup credentials, exact sensitive target identifiers, or other operationally sensitive values.

2. **Perform a readiness gap analysis**
   - Assess the pilot baseline against broader production-readiness needs:
     - retention duration and policy ownership;
     - scheduler independence from the application;
     - job-level success/failure visibility and alerting;
     - independent restore reproducibility;
     - PostgreSQL backup access isolation;
     - R2 uploaded-file durability, versioning, and recovery considerations.
   - Mark each item as current, partially addressed, deferred, or requiring a follow-up decision.

3. **Provide prioritized recommendations**
   - Compare reasonable future options for retention, scheduling, failure visibility, and R2 durability.
   - Identify prerequisites, operational owner, risk, and recommended priority for each option.
   - Recommendations must not be presented as implemented configuration.

4. **Preserve operational boundaries**
   - Keep restore as an operator-only runbook procedure.
   - Require least-privilege backup credentials for any future implementation.
   - Confirm that the normal application runtime cannot access backup storage or credentials.

5. **Keep project documentation consistent**
   - Add a dedicated backup/restore readiness review document.
   - Update the deployment runbook or README links only if needed to point to the review.
   - Do not alter the documented seven-copy pilot baseline.

## Non-Functional Requirements

- Documentation must be accurate, auditable, and explicit about evidence versus recommendation.
- No application schema, feature behavior, runtime, deployment topology, or backup configuration changes are included.
- No production restore or fresh operational drill is required; TRACK-047 evidence is authoritative for this review.
- Documentation must not create conflicting retention or durability commitments.
- All links to referenced repository documents must resolve.

## Acceptance Criteria

1. A dedicated readiness review document exists and is linked from the relevant operational documentation.
2. The document accurately records the TRACK-047 seven-copy local-plus-remote PostgreSQL backup baseline and isolated restore evidence.
3. Current configuration, observed evidence, identified gaps, and future recommendations are clearly separated.
4. Retention, scheduling, failure visibility, restore independence, backup credential isolation, and R2 durability/versioning are each assessed.
5. Recommendations include priority, ownership/prerequisites, and explicit implementation status.
6. No secrets, credentials, signed URLs, or sensitive backup-target identifiers are committed.
7. Restore remains explicitly operator-only.
8. The review does not claim that a 30-day logical-backup bucket, independent scheduler, expanded R2 policy, or failure alerting has been implemented.
9. Referenced documentation links resolve and no application code or schema changes are introduced.

## Out of Scope

- Implementing a new backup scheduler or job.
- Changing the current seven-copy retention policy.
- Point-in-time recovery.
- High-availability replicas.
- User-facing restore functionality.
- Cross-region active-active deployment.
- Mandatory R2 replication.
- Backup encryption beyond Cloudflare R2 managed encryption at rest.
- A fresh production backup or restore drill.
- Application schema or feature changes.
</protect>
