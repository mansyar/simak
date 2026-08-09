# Implementation Plan: TRACK-061 Institutional Reporting & Secure Delivery

## Phase 1 — Architecture and PDF Renderer Decision

- [x] Task: Define report contracts and renderer compatibility criteria (4ca8f4b)
  - [x] Write failing contract tests for the three allowlisted report types, role availability, normalized filters, locales, job states, and expiry calculation
  - [x] Implement the minimum shared report types and pure policy helpers
  - [x] Evaluate server-side PDF candidates against Node 20, ESM, Docker/Coolify, bilingual font embedding, multi-page tables, security, maintenance, and bundle constraints
  - [x] Record the renderer decision and rationale in `conductor/tech-stack.md` before adding the dependency
  - [x] Refactor and run focused tests
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Durable Report Jobs and Database Integrity

- [ ] Task: Add report-job persistence
  - [ ] Write failing schema tests for report type, requester, normalized parameters, locale, state, artifact metadata, failure metadata, timestamps, and 30-day expiry
  - [ ] Add the Drizzle schema, constraints, indexes, relations, and migration
  - [ ] Add cleanup-safe and concurrency-safe state-transition constraints
  - [ ] Run schema and migration-focused tests
- [ ] Task: Implement report-job transition helpers
  - [ ] Write failing unit and integration tests for valid transitions, stale updates, retries, completion, failure, and expiry
  - [ ] Implement transactional transition helpers using guarded updates or row locking
  - [ ] Verify rendering and R2 operations occur outside database transactions
  - [ ] Refactor and run focused tests
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Report Data and Authorization

- [ ] Task: Implement the role-scoped report catalog and filters
  - [ ] Write failing tests for Admin, SuperAdmin, Instructor, and Student catalog visibility
  - [ ] Write failing authorization tests for term, course, section, and cohort filters
  - [ ] Implement client-safe stubs and server-only handlers using `typedServerFn`
  - [ ] Reuse existing academic-context authorization and query patterns
  - [ ] Run focused unit and integration tests
- [ ] Task: Implement allowlisted report data loaders
  - [ ] Write failing tests for institutional academic summaries
  - [ ] Write failing tests for instructor-scoped analytics summaries
  - [ ] Write failing tests proving transcripts use released immutable academic records rather than mutable grades
  - [ ] Implement the minimum role-scoped loaders by reusing established analytics and academic-record calculations
  - [ ] Verify unauthorized and nonexistent entities are indistinguishable where required
  - [ ] Run focused tests
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — PDF Generation and Private Artifacts

- [ ] Task: Implement the server-only PDF renderer
  - [ ] Write failing renderer tests for all three templates, both locales, escaping, filter summaries, timestamps, pagination, and multi-page tables
  - [ ] Add the approved renderer and bundled bilingual font assets
  - [ ] Implement a server-only rendering adapter and the three fixed templates
  - [ ] Verify user-controlled content is escaped and no server-only renderer code reaches client bundles
  - [ ] Run focused tests and a production build compatibility check
- [ ] Task: Implement private R2 report storage
  - [ ] Write failing tests for opaque object keys, metadata persistence, authorized downloads, expiry, missing objects, and R2 failures
  - [ ] Implement upload and short-lived download URL helpers using existing storage conventions
  - [ ] Ensure object keys contain no unnecessary personal information
  - [ ] Run focused tests
- [ ] Task: Implement on-demand generation orchestration
  - [ ] Write failing tests for request, processing, completion, failure, safe errors, duplicate execution, and manual retry
  - [ ] Implement durable job creation and generation orchestration
  - [ ] Add server-side authorization checks at catalog, generation, status, retry, and download boundaries
  - [ ] Add audit events and privacy-safe structured logs
  - [ ] Run focused unit and integration tests
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Accessible Role-Scoped User Experience

- [ ] Task: Build report catalog, filter, and generation controls
  - [ ] Write failing component tests for role-specific catalogs, dependent filters, loading, validation, empty, and error states
  - [ ] Add English and Indonesian translation keys and regenerate i18n types
  - [ ] Implement responsive shadcn/Tailwind report controls using established route and form patterns
  - [ ] Verify keyboard access, labels, focus behavior, touch targets, and reduced-motion behavior
  - [ ] Run focused component and i18n tests
- [ ] Task: Build report history and artifact actions
  - [ ] Write failing tests for pending, processing, completed, failed, and expired displays
  - [ ] Write failing tests for authorized download and eligible retry actions
  - [ ] Implement status polling or explicit refresh using established TanStack Query patterns
  - [ ] Display expiry and safe failure information without exposing internal errors
  - [ ] Run focused component tests
- [ ] Task: Wire role routes and navigation
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
