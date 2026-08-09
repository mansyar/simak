# Implementation Plan: TRACK-061 Institutional Reporting & Secure Delivery

## Phase 1 — Architecture and PDF Renderer Decision [checkpoint: 4ca8f4b]

- [x] Task: Define report contracts and renderer compatibility criteria (4ca8f4b)
  - [x] Write failing contract tests for the three allowlisted report types, role availability, normalized filters, locales, job states, and expiry calculation
  - [x] Implement the minimum shared report types and pure policy helpers
  - [x] Evaluate server-side PDF candidates against Node 20, ESM, Docker/Coolify, bilingual font embedding, multi-page tables, security, maintenance, and bundle constraints
  - [x] Record the renderer decision and rationale in `conductor/tech-stack.md` before adding the dependency
  - [x] Refactor and run focused tests
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (4ca8f4b)

## Phase 2 — Durable Report Jobs and Database Integrity [checkpoint: d20c6ce]

- [x] Task: Add report-job persistence (dcddaec)
  - [x] Write failing schema tests for report type, requester, normalized parameters, locale, state, artifact metadata, failure metadata, timestamps, and 30-day expiry
  - [x] Add the Drizzle schema, constraints, indexes, relations, and migration
  - [x] Add cleanup-safe and concurrency-safe state-transition constraints
  - [x] Run schema and migration-focused tests
- [x] Task: Implement report-job transition helpers (5ad2837)
  - [x] Write failing unit and integration tests for valid transitions, stale updates, retries, completion, failure, and expiry
  - [x] Implement transactional transition helpers using guarded updates or row locking
  - [x] Verify rendering and R2 operations occur outside database transactions
  - [x] Refactor and run focused tests
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (d20c6ce)

## Phase 3 — Report Data and Authorization [checkpoint: 7ceeba1]

- [x] Task: Implement the role-scoped report catalog and filters [commit: 2fac961]
  - [x] Add failing tests, schema, migration, and academic-context input support for optional explicit section cohort metadata
  - [x] Write failing tests for Admin, SuperAdmin, Instructor, and Student catalog visibility
  - [x] Write failing authorization tests for term, course, section, and cohort filters
  - [x] Implement client-safe stubs and server-only handlers using `typedServerFn`
  - [x] Reuse existing academic-context authorization and query patterns
  - [x] Run focused unit and integration tests
- [x] Task: Implement allowlisted report data loaders [commit: 7ceeba1]
  - [x] Write failing tests for institutional academic summaries
  - [x] Write failing tests for instructor-scoped analytics summaries
  - [x] Write failing tests proving transcripts use released immutable academic records rather than mutable grades
  - [x] Implement the minimum role-scoped loaders by reusing established analytics and academic-record calculations
  - [x] Verify unauthorized and nonexistent entities are indistinguishable where required
  - [x] Run focused tests
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (7ceeba1)

## Phase 4 — PDF Generation and Private Artifacts [checkpoint: f21fe13]

- [x] Task: Implement the server-only PDF renderer [commit: 84380de]
  - [x] Write failing renderer tests for all three templates, both locales, escaping, filter summaries, timestamps, pagination, and multi-page tables
  - [x] Add the approved renderer and bundled bilingual font assets
  - [x] Implement a server-only rendering adapter and the three fixed templates
  - [x] Verify user-controlled content is escaped and no server-only renderer code reaches client bundles
  - [x] Run focused tests and a production build compatibility check
- [x] Task: Implement private R2 report storage [commit: 961bbce]
  - [x] Write failing tests for opaque object keys, metadata persistence, authorized downloads, expiry, missing objects, and R2 failures
  - [x] Implement upload and short-lived download URL helpers using existing storage conventions
  - [x] Ensure object keys contain no unnecessary personal information
  - [x] Run focused tests
- [x] Task: Implement on-demand generation orchestration [commit: f21fe13]
  - [x] Write failing tests for request, processing, completion, failure, safe errors, duplicate execution, and manual retry
  - [x] Implement durable job creation and generation orchestration
  - [x] Add server-side authorization checks at catalog, generation, status, retry, and download boundaries
  - [x] Add audit events and privacy-safe structured logs
  - [x] Run focused unit and integration tests
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) (f21fe13)

## Phase 5 — Accessible Role-Scoped User Experience

- [x] Task: Build report catalog, filter, and generation controls [commit: 3a61ae6]
  - [x] Write failing component tests for role-specific catalogs, dependent filters, loading, validation, empty, and error states
  - [x] Add English and Indonesian translation keys and regenerate i18n types
  - [x] Implement responsive shadcn/Tailwind report controls using established route and form patterns
  - [x] Verify keyboard access, labels, focus behavior, touch targets, and reduced-motion behavior
  - [x] Run focused component and i18n tests
- [x] Task: Build report history and artifact actions [commit: ada2b66]
  - [x] Write failing tests for pending, processing, completed, failed, and expired displays
  - [x] Write failing tests for authorized download and eligible retry actions
  - [x] Implement status polling or explicit refresh using established TanStack Query patterns
  - [x] Display expiry and safe failure information without exposing internal errors
  - [x] Run focused component tests
- [~] Task: Wire role routes and navigation
  - [ ] Write failing route tests for Admin, Instructor, and Student access boundaries
  - [ ] Implement role-scoped routes and sidebar entries
  - [ ] Verify mobile layout and accessible navigation
  - [ ] Run focused route tests
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6 — Expiry Cleanup and End-to-End Hardening

- [ ] Task: Implement idempotent expiry cleanup
  - [ ] Write failing tests for due selection, inaccessible-before-deletion behavior, R2 deletion, retries, already-missing objects, and idempotency
  - [ ] Implement a protected manual/operational cleanup entry point without recurring scheduling infrastructure
  - [ ] Mark reports expired before or independently of physical object deletion
  - [ ] Add audit events and structured cleanup summaries
  - [ ] Run focused unit and integration tests
- [ ] Task: Add critical end-to-end coverage
  - [ ] Write Playwright tests for Admin summary generation and download
  - [ ] Write Playwright tests for Instructor scope enforcement
  - [ ] Write Playwright tests for Student self-transcript generation
  - [ ] Add accessibility scans for the reporting surfaces
  - [ ] Run the relevant browser matrix
- [ ] Task: Complete track-wide quality verification
  - [ ] Run formatting and lint checks
  - [ ] Run type checking
  - [ ] Run i18n parity and unused-key checks
  - [ ] Run unit tests and coverage
  - [ ] Run report integration tests explicitly
  - [ ] Run the production build and verify renderer/runtime compatibility
  - [ ] Confirm all modified source and test files remain within the 500-line limit
  - [ ] Document any approved deviations
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
