# Implementation Plan: TRACK-062 — Risk History & Student Success

## Architecture Decisions

- Keep `computeStudentRisk` as the sole risk-scoring authority. Add a dedicated
  server-only observation recorder that consumes its current assessment and
  serializes a versioned explanation snapshot.
- Store immutable, idempotent event and daily-snapshot observations in a
  dedicated schema module. Model retention transformation explicitly so
  anonymized rows cannot be relinked to a student.
- Reuse existing assignment ownership/reassignment authorization and
  intervention lifecycle data; do not add a second eligibility or case-management
  model.
- Expose separate least-privilege projections for instructors, administrators,
  and students rather than filtering a detailed response in the client.
- Reuse existing scheduled-job, audit, analytics, i18n, and route conventions.
- Keep every source/test/script file below 500 lines; use the documented extras
  or multi-handler pattern only when it is necessary.

## Phase 1 — Contracts, schema, and migration [checkpoint: a6cecd1]

- [x] Task: Define risk-history contracts and failing validation tests (495842af)
  - Write failing tests for observation sources, immutable snapshot shape,
    algorithm version, event idempotency key, dates, filters, and role-specific
    response schemas.
  - Implement Zod contracts and client-safe `typedServerFn` stubs using the
    repository's established server-function pattern.
  - Confirm the tests transition from Red to Green.

- [x] Task: Add persistence model and migration (4a1bc400)
  - Write failing schema tests for observation identity, context references,
    append-only state, idempotency, retention/anonymization fields, and indexes.
  - Add the dedicated Drizzle schema/relations and generate a reviewed migration
    with required foreign keys, uniqueness constraints, and query indexes.
  - Confirm schema tests pass and migration SQL preserves the invariants.

- [x] Task: Phase verification and checkpoint (refer to `workflow.md`) [checkpoint: a6cecd1]
  - Verify tests, coverage, modularity, type safety, and migration review.
  - Provide the required manual verification plan, obtain explicit confirmation,
    attach the verification git note, and record the phase checkpoint.

## Phase 2 — Observation capture and lifecycle integration [checkpoint: 64da36b4]

- [x] Task: Implement the explainable observation recorder
  - Write failing tests for deterministic snapshots, factor/version preservation,
    append-only writes, idempotency, retries, audit events, and storage failures.
  - Implement the server-only recorder using `computeStudentRisk` and the live
    risk context without altering score semantics.
  - Confirm recorder tests pass.

- [x] Task: Capture meaningful lifecycle events (94c05433)
  - Write failing integration tests for checkpoint, submission/review,
    verified-consultation, and intervention transitions that affect risk context.
  - Wire post-commit capture into the existing lifecycle boundaries so a capture
    failure is observable/retryable but cannot roll back the completed academic
    mutation.
  - Verify no dashboard read or notification path creates a record.

- [x] Task: Add daily snapshot and retention processing (d2ee0182)
  - Write failing tests for active-assignment selection, daily idempotency,
    five-academic-year expiry, anonymization, auditability, and unrecoverable
    identity removal.
  - Implement scheduled daily snapshot and retention handlers using existing job
    conventions, with bounded processing and retry-safe behavior.
  - Confirm job tests pass.

- [x] Task: Phase verification and checkpoint (refer to `workflow.md`) [checkpoint: 64da36b4]
  - Verify lifecycle regression coverage, scheduler behavior, audit events, and
    no-automatic-action/no-notification guarantees before checkpointing.

## Phase 3 — Role-scoped history, outcomes, and aggregate APIs

- [ ] Task: Implement instructor history and intervention outcome queries
  - Write failing handler tests for current-owner access, reassignment transfer,
    time filtering, observation ordering, and academic/engagement outcomes.
  - Implement assignment-scoped instructor projections without exposing private
    notes outside the existing intervention boundary.
  - Confirm handler tests pass.

- [ ] Task: Implement privacy-safe admin aggregate queries
  - Write failing tests for academic-context authorization, cohort aggregation,
    suppression below ten students, and prevention of individual drill-down.
  - Implement indexed, bounded aggregate queries and audit sensitive access.
  - Confirm aggregate tests pass.

- [ ] Task: Implement student support projection
  - Write failing tests proving a student can access only their own approved
    support status/next steps and never scores, factors, internal explanations,
    notes, intervention detail, or aggregate data.
  - Implement the narrow student response and audit conventions.
  - Confirm privacy tests pass.

- [ ] Task: Phase verification and checkpoint (refer to `workflow.md`)
  - Verify authorization, reassignment, anonymization, and threshold tests with
    the required automated and manual verification protocol.

## Phase 4 — Accessible role-specific UI

- [ ] Task: Build instructor risk-history and outcome surfaces
  - Write failing component/route tests for timeline/order, explanatory labels,
    filters, loading/empty/error states, and reassignment-safe authorization.
  - Implement responsive, bilingual, keyboard-accessible instructor views.
  - Confirm component and route tests pass.

- [ ] Task: Build admin aggregate and student support surfaces
  - Write failing tests for cohort suppression, no-drill-down behavior, student
    privacy, constructive support language, and mobile/accessibility behavior.
  - Implement role-guarded, bilingual, responsive UI using existing primitives.
  - Regenerate and validate i18n types and confirm tests pass.

- [ ] Task: Phase verification and checkpoint (refer to `workflow.md`)
  - Verify visual/accessibility behavior at mobile and desktop sizes and obtain
    explicit manual confirmation before recording the checkpoint.

## Phase 5 — End-to-end quality and release readiness

- [ ] Task: Add end-to-end and regression coverage
  - Add E2E coverage for meaningful-event capture, daily snapshots, instructor
    reassignment, admin suppression, student privacy, retention anonymization,
    and the absence of automatic actions/notifications.
  - Confirm existing risk scoring, alerts, interventions, consultations,
    assignments, transcripts, analytics, and reporting behavior remains intact.

- [ ] Task: Complete full quality gates and documentation
  - Run the relevant unit/integration/E2E tests, coverage, typecheck, lint,
    formatting, i18n checks, modularity, and build.
  - Update implementation notes and any required operator/scheduler
    documentation.

- [ ] Task: Final phase verification and checkpoint (refer to `workflow.md`)
  - Present automated evidence and role-specific manual verification steps,
    await explicit approval, attach the verification report as a git note, and
    record the final checkpoint.
