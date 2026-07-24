# Product Roadmap: SIMAK Remediation

> **Methodology:** Context-Driven Development (CDD) via Conductor.
> **Purpose:** Global architectural index mapping the remediation path following a comprehensive three-way audit (bugs, performance, UX). Completed tracks are summarized as index entries with links to full specs in `conductor/archive/`. Active/planned tracks retain full detail until archived.

---

## Audit Summary

The audit identified issues across three categories:

| Category | Critical/High | Medium | Low | Total |
|----------|:---:|:---:|:---:|:---:|
| **Bugs** | 13 | 9 | 6 | 28 |
| **Performance** | 3 | ~12 | ~15 | ~30 |
| **UX** | 8 | ~12 | ~20 | ~40 |

Each track references individual findings by their audit ID (BUG-X, PERF-X, UX-X, ENH-X). See the full audit report for detailed descriptions, file locations, and reproduction steps.

---

## Global System Configuration & Context

Before initializing individual tracks, the following foundational context files must be present and updated in the repository:

- **PRD Source:** `docs/PRD.md` (Defines feature requirements and user logic)
- **TDD Source:** `docs/TDD.md` (Defines architecture, system design, and schemas)
- **Tech Stack:** `conductor/tech-stack.md` (Defines pinned languages, frameworks, and tools)
- **Guidelines:** `conductor/product-guidelines.md`, `conductor/code_styleguides/` (Defines code style, patterns, and testing thresholds)
- **Workflow:** `conductor/workflow.md` (Defines TDD lifecycle, commit format, and checkpoint protocol)
- **Audit Source:** This document (cross-references all audit findings by ID)

### Cross-Cutting Constraints

All tracks must adhere to the following project constraints:

- **Server function split:** Every feature has two files — `*.ts` (client-safe stub with `createServerFn` + dynamic import) and `*.server.ts` (handler with DB code). See `AGENTS.md` → "Server function split".
- **File limit:** Max 500 lines per file in `src/`, `tests/`, `scripts/`.
- **i18n:** All new user-visible strings must be added to both `locales/en.json` and `locales/id.json`, then `pnpm generate:i18n`.
- **Testing:** TDD per `conductor/workflow.md`. Coverage thresholds: lines/functions/branches/statements ≥ 80%. Integration tests excluded from default run.
- **Concurrency pattern:** All checkpoint state transitions must use `db.transaction` + `.for('update')` inside the transaction, with status re-check after locking. Gold standard: `submitCheckpointHandler` (`src/server/submissions.server.ts`).

---

## Milestone 1: Critical Fixes (Concurrency, Data Integrity, Deadlines)

> These tracks address data corruption risks, race conditions, and logic errors that can cause incorrect state or lost data. They should be prioritized above all other work.

---

### TRACK-001: Concurrency & Transaction Safety
- **Status:** ✅ Complete · **Audit IDs:** BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9, BUG-13, BUG-17, BUG-22 · **Deps:** None
- **Key decisions:** `FOR UPDATE` + post-lock status re-check on all state transitions; instructor soft-delete requires reassigning all active assignments first; student soft-delete auto-rejects pending consultations/extensions; DB-first then auth API for 2FA disable; catch PG `23505` for email uniqueness
- **Detail:** `conductor/archive/concurrency-tx-safety_20260718/` (spec.md, plan.md)

### TRACK-002: Deadline & SLA Logic Correctness
- **Status:** ✅ Complete · **Audit IDs:** BUG-3, BUG-11, BUG-12, BUG-16, BUG-18, BUG-19, BUG-21, BUG-28 · **Deps:** None (coordinate with TRACK-001)
- **Key decisions:** `finalDeadline` is immutable (course-wide); per-student effective deadlines derived from checkpoint `dueDate` values via shared `computeEffectiveDeadline` helper; SLA clock anchored to submission upload time (`anchorTime` rename); `finalDeadline` cap enforced at creation time only
- **Detail:** `conductor/archive/deadline-sla-correctness_20260719/` (spec.md, plan.md)

### TRACK-003: Input Validation & Data Integrity
- **Status:** ✅ Complete · **Audit IDs:** BUG-10, BUG-15, BUG-24, BUG-25, BUG-26, BUG-27 · **Deps:** None
- **Key decisions:** Typed builder pattern (`.inputValidator(Schema)`) on all settings stubs; `getObjectContentLength` returns discriminated type (`not_configured`/`not_found`/`size`); validate ALL `studentIds` are active students pre-transaction; `EMAIL_FROM` added to `env.ts`; `instructorId` moved to WHERE clause; store R2-verified `actualSize` not client-reported `fileSize`
- **Detail:** `conductor/archive/input-validation-data-integrity_20260719/` (spec.md, plan.md)

### TRACK-004: Email Queue Robustness
- **Status:** ✅ Complete · **Audit IDs:** BUG-4, BUG-20, PERF-32, PERF-33 (re-scoped) · **Deps:** None
- **Key decisions:** Re-scoped to admin observability — queue inspector UI (`/admin/email-queue`) + manual retry (`FOR UPDATE` + idempotent guard) + structured logging + `EMAIL_FROM` config hygiene; original BUG-4/BUG-20/PERF-32/33 deferred to TRACK-016
- **Detail:** `conductor/archive/email-queue-robustness_20260719/` (spec.md, plan.md)

---

## Milestone 2: Performance & Optimization

> These tracks address database performance, query efficiency, and bundle safety. TRACK-005 (indexes) should be completed before TRACK-006 (query optimization) as indexes are a prerequisite for optimal query plans.

---

### TRACK-005: Database Indexes & Schema Optimization
- **Status:** ✅ Complete · **Audit IDs:** PERF-7, PERF-8, PERF-9, PERF-10, PERF-11, PERF-12, PERF-13, PERF-14 · **Deps:** None
- **Key decisions:** 7 new indexes + 2 replaced (`consultations_status` → composite `(assignmentId, status)`, `reviews_submission_id` → composite `(submissionId, createdAt)`); added table-callback functions to 4 previously plain-object tables; standard migration (no `CONCURRENTLY`)
- **Detail:** `conductor/archive/database-indexes-schema-optimization_20260719/` (spec.md, plan.md)

### TRACK-006: Query & Data-Fetching Optimization
- **Status:** ✅ Complete · **Audit IDs:** PERF-1–6, PERF-15–21, PERF-23–26, PERF-35, BUG-14 · **Deps:** TRACK-005
- **Key decisions:** N+1 elimination via `GROUP BY` + bulk `UPDATE ... WHERE`; full pagination on 5 list handlers + `.limit(20)` safety caps on dashboards; `LATERAL` join for latest-submission-per-checkpoint; narrow `SELECT` + explicit response construction (no `...item` spread); R2 `HEAD` moved before transaction; PERF-36 deferred
- **Detail:** `conductor/archive/query-data-fetching-optimization_20260719/` (spec.md, plan.md)

### TRACK-007: Session Caching & Bundle Safety
- **Status:** ✅ Complete · **Audit IDs:** PERF-22, PERF-34 · **Deps:** None
- **Key decisions:** 5s TTL in-memory session cache (`Map`) with lazy eviction; `auth.ts` split to two-file pattern (stub + handler); soft-delete check skipped on cache hit (5s delay tradeoff); PERF-37 (template caching) dropped
- **Detail:** `conductor/archive/session-caching-bundle-safety_20260719/` (spec.md, plan.md)

---

## Milestone 3: UX & Accessibility

> These tracks address user experience gaps, broken functionality, accessibility violations, and i18n compliance. Most tracks are independent and can be parallelized.

---

### TRACK-008: Critical UX Fixes (Broken Functionality)
- **Status:** ✅ Complete · **Audit IDs:** UX-29, UX-38, UX-39, UX-57 · **Deps:** None
- **Key decisions:** `FileUploader` `onResetSuccess` callback prop; 404/ErrorBoundary links to `/` with new `common.goHome` i18n key; pagination hidden on empty lists
- **Detail:** `conductor/archive/critical-ux-fixes_20260720/` (spec.md, plan.md)

### TRACK-009: Action Feedback & Loading States
- **Status:** ✅ Complete · **Audit IDs:** UX-1–9, UX-30, UX-31, UX-32 · **Deps:** None
- **Key decisions:** `showSuccessToast` helper + `toast.success` on all `onSuccess` handlers; 3 reusable skeleton components + `pendingComponent` on 7 routes; network vs server error differentiation; side-data error banner with retry; UX-33 (undo) dropped
- **Detail:** `conductor/archive/action-feedback-loading-states_20260720/` (spec.md, plan.md)

### TRACK-010: Accessibility (a11y) & i18n Compliance
- **Status:** ✅ Complete · **Audit IDs:** UX-13–24, UX-50 · **Deps:** None
- **Key decisions:** `NotificationCenter` refactored to shadcn `Sheet` (focus trap, Escape, backdrop); `NotificationItem` → `<button>`; dynamic `aria-label` with unread count; `formatDate` replaces `toLocaleDateString`; ARIA on progress bars/collapsibles/icon buttons; `aria-hidden` on decorative elements
- **Detail:** `conductor/archive/accessibility-i18n-compliance_20260720/` (spec.md, plan.md)

### TRACK-011: Search Debounce & Form Validation
- **Status:** ✅ Complete · **Audit IDs:** UX-25, UX-26, UX-27, UX-28, UX-54, UX-56 · **Deps:** None
- **Key decisions:** Custom `useDebouncedCallback` hook (300ms) on 4 server-side search inputs; 3 forms migrated to `react-hook-form` + Zod (`onBlur` validation); `XMLHttpRequest` replaces `fetch` for upload progress; X clear-button on search inputs
- **Detail:** `conductor/archive/search-debounce-form-validation_20260720/` (spec.md, plan.md)

### TRACK-012: Notifications & File Management UX
- **Status:** ✅ Complete · **Audit IDs:** UX-41, UX-42, UX-46, UX-48, UX-49, UX-51, UX-53, PERF-27, PERF-29, PERF-30, PERF-31 · **Deps:** TRACK-010
- **Key decisions:** Notification `metadata` → client-side route map → navigable `<Link>` items; "Next Review" button; All/Unread tabs + "Load More"; DOCX "preview not available" card; "Latest" version badge; `staleTime: 30s` + `refetchInterval: 30s` + `React.memo` + `useMemo`; UX-47/UX-52 dropped
- **Detail:** `conductor/archive/notifications-file-management-ux_20260720/` (spec.md, plan.md)

### TRACK-013: Empty States, Date Display & Mobile Polish
- **Status:** ✅ Complete · **Audit IDs:** UX-10, UX-11, UX-12, UX-34, UX-35, UX-36, UX-43, UX-45 · **Deps:** Coordinate with TRACK-010
- **Key decisions:** `EmptyState` component replaces `null` returns; `formatDistanceToNow` for relative dates; `SLABadge` `title` tooltip; mobile card layout for `ProgressTable`; `flex-col` responsive for `CheckpointListEditor`; UX-44 (timezone) dropped
- **Detail:** `conductor/archive/empty-states-date-display-mobile-polish_20260721/` (spec.md, plan.md)

---

## Milestone 4: Quality Assurance

> This milestone addresses testing infrastructure. It is not tied to specific audit findings — it implements end-to-end test coverage for critical user flows.

---

### E2E-FEAT-001: E2E Testing with Playwright
- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing infrastructure) · **Deps:** None (requires core features)
- **Key decisions:** Dedicated `postgres-test` DB (port 5433); `loginAsRole` via API submit (Base UI Button renders `type="button"`); R2 upload not E2E-tested (TanStack Start server-fn limitation — direct DB insertion workaround); `workers: 1` for DB isolation; `reuseExistingServer` CI-conditional
- **Detail:** `conductor/archive/e2e-playwright-tests_20260721/` (spec.md, plan.md)

---

## Milestone 5: Post-Audit Enhancements

> These tracks address improvement opportunities identified in a follow-up audit conducted after the completion of Milestones 1–3 (the original 98-issue, 13-track remediation) and Milestone 4 (E2E test coverage). Findings are prefixed `ENH-` to distinguish them from the original `BUG-X`/`PERF-X`/`UX-X` audit IDs. Several tracks also pull in items deliberately deferred from the original audit (BUG-4, BUG-20, PERF-32/33). Tracks are ordered by recommended priority: quick wins first, then operational hygiene, productivity, and finally larger feature builds.
>
> **Note:** E2E test coverage (originally a candidate for this milestone) was implemented upstream in Milestone 4 (E2E-FEAT-001) and is therefore excluded here.

---

### TRACK-014: Optimistic UI Updates for Mutations
- **Status:** ✅ Complete · **Audit IDs:** ENH-PERF-1 · **Deps:** None (introduces query-key factory consumed by later tracks)
- **Key decisions:** Query-key factory (6 domains); 5 plain `async`+`useState` mutations refactored to `useMutation`+`useQuery`; optimistic `onMutate`/`onError`/`onSettled` on 9 mutation sites; server-error rollback via `throw` on `!result.success`; `DeadlineManager` invalidation fix
- **Detail:** `conductor/archive/optimistic-ui-updates_20260722/` (spec.md, plan.md)

### TRACK-015: UI Hygiene & Tech-Debt Quick Wins
- **Status:** ✅ Complete · **Audit IDs:** ENH-UX-1, ENH-TD-1 · **Deps:** TRACK-014
- **Key decisions:** Footer "About" → `#how-it-works` anchor, "Contact" removed, copyright via i18n key; 3 `useEffect`+`useState` fetches → `useQuery` (removes `eslint-disable exhaustive-deps`); ENH-TD-2 invalid (`toast.error` already present)
- **Detail:** `conductor/archive/ui-hygiene-tech-debt-quick-wins_20260722/` (spec.md, plan.md)

### TRACK-016: Email Queue Retention & Delivery Completeness
- **Status:** ✅ Complete · **Audit IDs:** ENH-OPS-1, BUG-4, BUG-20, PERF-32, PERF-33 · **Deps:** None
- **Key decisions:** `resendMessageId` column populated from Resend response; retention `DELETE` (sent >90d, failed >180d) via tick-embedded `lastPruneAt`; chunked `Promise.allSettled` sends (batches of 5)
- **Detail:** `conductor/archive/email-queue-retention-delivery-completeness_20260722/` (spec.md, plan.md)

### TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts
- **Status:** ✅ Complete · **Audit IDs:** ENH-UX-2, ENH-UX-3, ENH-PERF-2 · **Deps:** None
- **Key decisions:** `mammoth.js` (dynamic import) for `.docx` → HTML in sandboxed `iframe` (`sandbox=""`); 10MB size guard; two-layer keyboard shortcuts (global `R`/`?` + review `J`/`K`); preload pending review list for instant J/K nav; `preload="intent"` on sidebar links
- **Detail:** `conductor/archive/instructor-productivity-docx-preview-keyboard-shortcuts_20260722/` (spec.md, plan.md)

### TRACK-018: Event Email Notifications
- **Status:** ✅ Complete · **Audit IDs:** ENH-FEAT-1 · **Deps:** None
- **Key decisions:** 8 event email templates (`email-templates.ts`) alongside in-app notifications; post-commit advisory `enqueueEmail` (try/catch, no rollback); `template_type` CHECK extended 4→12; `resolveEmailRecipient` skips soft-deleted/unverified; per-user preferences deferred
- **Detail:** `conductor/archive/event-email-notifications_20260722/` (spec.md, plan.md)

### TRACK-019: Analytics & Reporting
- **Status:** ✅ Complete · **Audit IDs:** ENH-FEAT-2 · **Deps:** None
- **Key decisions:** Phased delivery (dashboards then export); admin + instructor analytics with URL date-range params; CSV via server-fn returning string + client `Blob`; Excel via existing `xlsx` dep; no new DB tables; CSV injection mitigation; no charting lib (tables/progress bars)
- **Detail:** `conductor/archive/analytics-reporting_20260722/` (spec.md, plan.md)

---

## Milestone 6: New Features

> New feature tracks beyond the original audit remediation (Milestones 1–3), E2E testing (Milestone 4), and post-audit enhancements (Milestone 5). These tracks build on the hardened foundation to add new product capabilities.

---

### TRACK-020: Rubric-Based Grading & Evaluation

*   **Status:** `Pending`
*   **Dependencies:** None
*   **Estimated Effort:** 10 Days / 5 Sprint Loops

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#assignment-templates` (template + checkpoint definition — admin-owned), `docs/PRD.md#checkpoints--submissions` (review workflow — currently pass/revise with comments, no structured evaluation), `docs/PRD.md#analytics--reporting` (rubric analytics extension point)
*   **TDD Reference:** `docs/TDD.md` line 432 `template_checkpoints` table (extend with `grading_type`), line 503 `reviews` table (extend with criterion scores via `review_scores` join), line 316 §3 Data Model (new tables: `rubric_criteria`, `rubric_levels`, `review_scores`); `src/db/schema/assignments.ts` `checkpoints` table (add `templateCheckpointId` FK); `src/server/templates.server.ts:267` `updateTemplateHandler` (refactor from delete+reinsert to upsert)

#### Track Tech Stack
*   Drizzle ORM — new tables: `rubric_criteria` (with `deletedAt` for soft-delete), `rubric_levels` (with `deletedAt` for soft-delete), `review_scores` (full denormalized snapshot); new columns: `template_checkpoints.grading_type` (pgEnum, nullable), `checkpoints.templateCheckpointId` (FK, nullable, backfill existing via `assignments.templateId + order` matching)
*   Drizzle Kit migration (`pnpm db:generate` + `pnpm db:migrate` + rollback file per SQL styleguide §5.1) — includes `checkpoints.templateCheckpointId` backfill
*   Existing file refactor: `src/server/templates.server.ts` `updateTemplateHandler` (line 267) — change from delete+reinsert to upsert/diff to preserve checkpoint IDs
*   Existing file extensions: `src/server/reviews.ts` (Zod schema for `SubmitReviewSchema`), `src/server/reviews.server.ts` (`getReviewDetailHandler` + `submitReviewHandler`), `src/server/reviews-extras.server.ts` (`getLatestReviewHandler`)
*   TanStack Start server functions — two-file split: `rubrics.ts` (stubs + Zod schemas) + `rubrics.server.ts` (handlers)
*   shadcn/ui components — `Slider`/`Select` for scoring, `Card` for rubric display, `Table` for analytics; integrate into `src/components/admin/templates/CheckpointListEditor.tsx`
*   i18n codegen — new keys in both `locales/en.json` and `locales/id.json` (`rubrics.*` namespace)

#### Scope Boundaries
*   **In Scope:**
    *   **Schema — grading_type:** Add `grading_type` pgEnum column to `template_checkpoints` (nullable, defaults to `null`): `null` = no rubric (pass/fail only, current behavior), `'numeric'` = direct 0–100 scoring per criterion, `'qualitative'` = level-based scoring with configurable numeric mapping per checkpoint
    *   **Schema — checkpoints FK:** Add `templateCheckpointId` FK column to `checkpoints` table (nullable for backward compat, backfill existing rows via `assignments.templateId + order` matching at migration time). Enables direct FK lookup of rubric data from per-student checkpoints
    *   **Schema — rubric_criteria:** Create table (FK to `template_checkpoints.id`): `title`, `description`, `weight` (0–100, individual CHECK), `order`, `deletedAt` (nullable — soft-delete, never hard-delete, consistent with `assignments`/`assignmentTemplates` pattern)
    *   **Schema — rubric_levels:** Create table (FK to `template_checkpoints.id`, qualitative only): `label`, `description`, `score` (0–100, individual CHECK), `order`, `deletedAt` (nullable — soft-delete). Shared across all criteria in that checkpoint (v1 — per-criterion levels deferred to v2)
    *   **Schema — review_scores:** Create table (FK to `reviews.id`): `criterionId` (FK to `rubric_criteria.id`), `criterionTitle` (denormalized string snapshot), `score` (0–100, denormalized), `rubricLevelId` (nullable FK to `rubric_levels.id` — qualitative only), `levelLabel` (denormalized string snapshot, nullable), `comment`. Full denormalized snapshot so historical reviews are unaffected by later rubric edits — deleted criteria/levels remain visible via snapshot fields
    *   **Refactor — updateTemplateHandler:** Refactor `src/server/templates.server.ts:267` from delete+reinsert (`db.delete(templateCheckpoints)` + `db.insert`) to upsert/diff approach — preserve existing checkpoint IDs when only metadata changes (name, minConsultations, estimatedDuration). Only create new IDs for genuinely new checkpoints, soft-delete removed checkpoints. Required so rubric FKs survive template edits
    *   **Rubric lookup model:** Rubric is always looked up live from the template at review time via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`. Admin edits to rubric propagate to all pending reviews. `review_scores` stores a full denormalized snapshot (score + criterion title + level label) so completed reviews are preserved
    *   **Admin UI:** Rubric builder integrated into `src/components/admin/templates/CheckpointListEditor.tsx` (used by `CreateTemplateDialog.tsx` and `TemplateCheckpointSection.tsx`) — grading type selector per checkpoint, criteria editor (title/description/weight/order), qualitative level configurator (label/score/description). Weight sum validation (must = 100%, enforced at Zod application layer — not a DB CHECK constraint since it spans multiple rows)
    *   **Instructor UI:** Rubric scoring integrated into `src/components/reviews/ReviewForm.tsx` (rendered on `src/routes/_authenticated/instructor/reviews/$submissionId.tsx`) — render criteria alongside `ReviewFilePreview`, score each criterion (numeric `Slider`/`Input` or qualitative `Select` based on `grading_type`), auto-compute weighted checkpoint total. All criteria must be scored before review submission. Skip rubric UI entirely when `grading_type` is `null` (current pass/fail behavior unchanged)
    *   **Instructor data fetch:** Extend `getReviewDetailHandler` (`src/server/reviews.server.ts:137`) to also return rubric criteria + levels for the checkpoint being reviewed (via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`)
    *   **Instructor submit:** Extend `SubmitReviewSchema` in `src/server/reviews.ts` with optional `scores` array: `z.array(z.object({ criterionId, score (0–100), rubricLevelId?, comment? })).optional()`. Required when `grading_type` is not `null`, rejected when `null`. Extend `submitReviewHandler` (`reviews.server.ts:220`) to persist scores via `review_scores` (with denormalized snapshot fields)
    *   **Student UI:** Rubric result view on `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` — per-criterion score, level label (if qualitative), instructor comment, weighted total. Read-only, rendered alongside existing `SubmissionStatus` component
    *   **Student data fetch:** Extend `getLatestReviewHandler` (`src/server/reviews-extras.server.ts:89`) to also return `review_scores` for the latest review (including denormalized `criterionTitle` and `levelLabel` snapshot fields)
    *   **Rubric analytics:** Extend `analytics-instructor.server.ts` (avg score per criterion, criterion-level pass/fail rates) and `analytics-admin.server.ts` (cross-instructor criterion performance, class-wide weakness identification)
    *   **CSV/Excel export:** Extend `analytics-export.server.ts` + `src/lib/excel-export.ts` (from TRACK-019) for per-student criterion scores
    *   i18n keys for all new labels in both locales
*   **Out of Scope:**
    *   Instructor-owned rubric library (rubrics are template-bound, admin-owned — centralized control per design decision)
    *   Per-criterion qualitative levels (v1 levels are per-checkpoint, shared across all criteria — per-criterion levels deferred to v2)
    *   Instructor weight adjustment (v2 — instructor can re-weight criteria per assignment but cannot add/remove criteria)
    *   Rubric revision proposal workflow (v2 — instructor suggests criteria changes, admin approves)
    *   Grade transcripts / final grade aggregation across checkpoints (separate future track)
    *   Reusable rubric fragments across templates (v2)

#### High-Level Execution Vectors
*   **Phase 1 (Schema, Migration & Refactor):** Add `grading_type` pgEnum column to `template_checkpoints` (nullable, defaults to `null`). Add `templateCheckpointId` FK to `checkpoints` (nullable, backfill existing via `assignments.templateId + order` matching). Create `rubric_criteria` (with `deletedAt`), `rubric_levels` (with `deletedAt`), `review_scores` (with full denormalized snapshot: `criterionTitle`, `levelLabel`) tables with FKs to `template_checkpoints` and `reviews`. Refactor `updateTemplateHandler` (`src/server/templates.server.ts:267`) from delete+reinsert to upsert/diff — preserve checkpoint IDs. Run `pnpm db:generate` + `pnpm db:migrate`. Create rollback file. Write schema tests (column existence, individual CHECK constraints for `weight 0–100` and `score 0–100`, FK integrity, `deletedAt` soft-delete behavior). Verify: migration applies cleanly, backfill populates `templateCheckpointId` correctly, rollback works, `updateTemplateHandler` preserves checkpoint IDs on edit.
*   **Phase 2 (Rubric CRUD — Admin):** Create `rubrics.ts` (Zod schemas + `createServerFn` stubs) + `rubrics.server.ts` (handlers) for rubric CRUD: create/update/soft-delete criteria + levels per template checkpoint. Admin-only (local `isAdmin` type guard, matching pattern in `templates.server.ts:24`). Zod validation: weights sum to 100% (application-layer, not DB CHECK — spans multiple rows), scores 0–100, grading type consistency (levels only when `qualitative`). Integrate into `src/components/admin/templates/CheckpointListEditor.tsx` — grading type selector, criteria editor, qualitative level configurator. Verify: admin can create/edit/soft-delete rubrics, non-admins rejected, weight validation enforced, rubric survives template metadata edits (checkpoint IDs preserved).
*   **Phase 3 (Rubric-Based Review — Instructor):** Extend `SubmitReviewSchema` in `src/server/reviews.ts` with optional `scores: z.array(z.object({ criterionId, score (0–100), rubricLevelId?, comment? })).optional()`. Extend `submitReviewHandler` (`src/server/reviews.server.ts:220`) to accept + persist criterion scores via `review_scores` (with denormalized `criterionTitle` + `levelLabel` snapshot fields). Extend `getReviewDetailHandler` (`reviews.server.ts:137`) to also return rubric criteria + levels (via `checkpoints.templateCheckpointId → template_checkpoints → rubric_criteria/rubric_levels`). Render rubric criteria in `src/components/reviews/ReviewForm.tsx` — numeric `Input` (0–100) or qualitative `Select` (level → score) based on `grading_type`. Auto-compute weighted checkpoint total. Validate all criteria are scored before submission (skip validation when `grading_type` is `null`). Review state machine (pass/revise) unchanged — rubric scores are additive metadata. Verify: instructor can score criteria, weighted total computed correctly, unscored criteria block submission, qualitative level selection maps to numeric score, checkpoints without rubric (`grading_type: null`) use current pass/fail flow unchanged.
*   **Phase 4 (Student View & Analytics):** Extend `getLatestReviewHandler` (`src/server/reviews-extras.server.ts:89`) to also return `review_scores` (including `criterionTitle` + `levelLabel` snapshot). Student checkpoint detail (`src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx`) shows rubric results — per-criterion score, level label (if qualitative), instructor comment, weighted total. Extend `analytics-instructor.server.ts` + `analytics-admin.server.ts` with rubric metrics (avg per criterion, criterion-level weakness analysis, cross-instructor comparison). Extend `analytics-export.server.ts` + `src/lib/excel-export.ts` for per-student criterion scores CSV/Excel export. Add all i18n keys to both locales. Run `pnpm generate:i18n`. Verify: student sees scores (including for soft-deleted criteria via snapshot), analytics show criterion performance, exports are valid, `pnpm check:i18n` parity.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Admin creates a template checkpoint with `numeric` grading type and 3 criteria (weights sum to 100%) — saved. Admin creates a checkpoint with `qualitative` grading type and 3 levels (Below: 40, Meets: 70, Exceeds: 95) — saved. A checkpoint with no grading type stays simple pass/fail. Admin edits a checkpoint name (metadata only) — rubric data survives (checkpoint ID preserved by upsert). Admin soft-deletes a criterion — it disappears from new reviews but remains visible in historical reviews via snapshot. Instructor reviews a numeric checkpoint — enters scores per criterion, sees weighted total. Instructor reviews a qualitative checkpoint — picks levels, sees weighted total. Instructor reviews a checkpoint with no rubric — current pass/fail flow, no rubric UI. Student views their checkpoint — sees per-criterion scores, comments, and weighted total (including for soft-deleted criteria). Analytics page shows criterion-level performance averages. CSV/Excel export downloads per-student criterion scores.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: schema validation (`grading_type` pgEnum, individual CHECK on `weight 0–100` and `score 0–100`, FK integrity, `deletedAt` soft-delete), `updateTemplateHandler` upsert (checkpoint IDs preserved on metadata edit, new IDs only for new checkpoints), `templateCheckpointId` backfill correctness, rubric CRUD handlers (create/update/soft-delete, admin-only via local `isAdmin`, weight-sum validation at application layer, qualitative-only levels), review scoring (numeric input, qualitative level mapping, weighted total computation, all-criteria-scored validation, `scores` optional when `grading_type` is `null`, denormalized snapshot unaffected by later rubric edits — criterion title and level label preserved after soft-delete), `getReviewDetailHandler` returns rubric data, `getLatestReviewHandler` returns review_scores, student view rendering, analytics aggregation (avg per criterion, cross-instructor comparison). `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** `grading_type` pgEnum column on `template_checkpoints` (nullable). `templateCheckpointId` FK on `checkpoints` (nullable, backfilled). `rubric_criteria` and `rubric_levels` have `deletedAt` (soft-delete). `review_scores` stores full denormalized snapshot (`criterionTitle`, `levelLabel` — historical reviews unaffected by rubric edits). Weight-sum validation at Zod application layer (not DB CHECK — spans multiple rows). `updateTemplateHandler` refactored to upsert (checkpoint IDs preserved). Server function two-file split followed (`rubrics.ts` + `rubrics.server.ts`). Existing handlers extended in-place (`reviews.ts`, `reviews.server.ts`, `reviews-extras.server.ts`). All files under 500 lines. Migration has rollback file. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

### TRACK-021: Proactive Deadline Reminder System
- **Status:** ✅ Complete · **Deps:** None
- **Key decisions:** Background scanner (`processDeadlineReminders()`) runs hourly via email-queue tick throttled by `lastReminderScanAt`; tiered reminders (7d/3d/1d lead times) with non-overlapping bands (`>3d`/`>1d`/`>0d`) firing in-app notifications + emails; `deadline_reminders` dedup table with unique `(checkpointId, tier)` + `ON CONFLICT DO NOTHING RETURNING *` for multi-instance safety; `checkpoints_state_due_date_idx` composite index; dedup + notification inserts wrapped in `db.transaction` (atomicity — if notification insert fails, dedup row rolls back so the tier can retry); email dispatch post-commit via `Promise.allSettled` (advisory, never throws); `deadline_reminder` added to `email_queue.templateType` Drizzle text enum (code-only, no `ALTER TYPE`); email subject `{assignmentTitle}` interpolated via `subjectParams` on `enqueueEventEmail`; scanner failure isolated via `try/catch` in `tick()` (email processing unaffected)
- **Detail:** `conductor/archive/proactive-deadline-reminders_20260723/` (spec.md, plan.md)

### TRACK-022: User Notification Preferences
- **Status:** ✅ Complete · **Deps:** None (recommended AFTER TRACK-021 — prevents `deadline_reminder` notifications from being un-mutable; TRACK-021 is now complete)
- **Key decisions:** Per-user, per-type, per-channel notification preferences stored in existing `users.settings` JSONB column (no separate table, no migration); 12 types across 4 groups (Reviews, Consultations, Submissions, System) with independent Email + In-app toggles (default all ON — opt-out); `updateUserSettingsHandler` refactored from replace to read-modify-write merge (prevents `notificationPrefs` from clobbering `reducedMotion`); email gate in `enqueueEventEmail` (skip enqueue when `notificationPrefs[type].email === false`); in-app gate via `shouldSendInAppNotification` helper at 12 creation sites; `EMAIL_GATE_EXEMPT` set for 4 security types (password_reset, invitation, two_factor, sla_alert); `notificationType` param resolves `sla_breach`↔`sla_alert` and `deadline_extended`↔`extension_approved` type mismatches; `sla_breach` email always sent to admins (bypasses gate via `enqueueEmail` direct call — email toggle hidden in UI); `maybeInsertNotification` helper reduces code duplication at 4 consultation/review sites
- **Detail:** `conductor/archive/user-notification-preferences_20260723/` (spec.md, plan.md)

### TRACK-023: At-Risk Student Identification & Early Warning System

*   **Status:** `Pending`
*   **Dependencies:** None (complementary to TRACK-021 — event-driven alerts catch discrete risk moments, TRACK-021's scanner catches time-based risk. If both are implemented, TRACK-021's scanner can optionally call risk scoring for signal 2/3 coverage)
*   **Estimated Effort:** 5 Days / 3 Sprint Loops

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (checkpoint lifecycle, review workflow — the domain where at-risk identification applies), `docs/PRD.md#analytics--reporting` (instructor/admin analytics — extension point for at-risk aggregate)
*   **TDD Reference:** `docs/TDD.md` `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `dueDate`, `minConsultations`, `studentId`), `assignment_students` join table (`src/db/schema/assignments.ts:56` — maps students to assignments), `consultations` table (`src/db/schema/consultations.ts` — `status`, `checkpointId` for verified count), `reviews` table (`src/db/schema/submissions.ts` — `decision` for revise count), `submissions` table (`src/db/schema/submissions.ts` — `uploadedAt` for wait time); `src/server/dashboard-instructor.server.ts:53-255` (`getInstructorDashboardDataHandler` — extension point, currently returns `pendingReviewCount`, `pendingReviewItems`, `recentSubmissions`, `assignments` with per-assignment `overallProgressPercent` but NO per-student risk), `src/lib/review-sla.ts:72-130` (`dispatchSLABreachNotifications` — existing pattern for advisory batch notification + email dispatch), `src/server/reviews.server.ts:220` (`submitReviewHandler` — event site for revise-triggered risk alert), `src/server/analytics-admin.server.ts` (`getAdminAnalyticsDataHandler` — extension point for aggregate at-risk counts, currently computes `deadlineBreachRate`), `src/components/notifications/NotificationCenter.tsx:15-36` (`GROUP_CONFIGS` — 4 groups, `student_at_risk` fits in `system` group)

#### Track Tech Stack
*   Drizzle ORM — NO new tables, NO migration. All risk signals are computed from existing data (checkpoint states, due dates, consultation counts, review decisions, submission timestamps). Risk score is ephemeral — computed on-demand for dashboard, at event time for alerts. Never persisted
*   New shared module: `src/lib/risk-scoring.ts` — pure functions, no DB access. Exports `computeStudentRisk(data: StudentRiskInput): RiskAssessment` and types (`RiskLevel = 'low' | 'medium' | 'high'`, `RiskFactor`, `RiskCategory = 'student_inaction' | 'pending_review'`). Called from dashboard handler (on-demand) and event sites (after review commit)
*   New shared module: `src/lib/risk-alerts.ts` — `checkAndFireRiskAlert(db, { studentId, assignmentId, instructorId, studentName, assignmentTitle })`: fetches student checkpoint data, calls `computeStudentRisk`, checks 7-day dedup via `notifications` table, fires in-app notification + email. Advisory (try/catch, never throws)
*   Existing file extension: `src/server/dashboard-instructor.server.ts` — add at-risk student list to response (batch query joining checkpoints + assignments + assignment_students + users + consultations + submissions + reviews, pass to `computeStudentRisk`). Currently 255 lines — has room for extension before 500-line limit
*   Existing file extension: `src/server/analytics-admin.server.ts` — add aggregate at-risk counts (simplified SQL counting distinct students matching each signal's criteria — no per-student risk function needed for aggregate)
*   Existing file extension: `src/server/reviews.server.ts` `submitReviewHandler` (line 220) — after review transaction commit, when `decision === 'revise'` OR SLA breach occurred, call `checkAndFireRiskAlert` (advisory, post-commit, outside transaction)
*   shadcn/ui components — `Badge` for risk level (yellow=low, orange=medium, red=high), `Card`/`CardHeader`/`CardContent` for at-risk widget, `Tooltip` for risk factor details. New widget component on instructor dashboard route (`src/routes/_authenticated/instructor/dashboard.tsx`)
*   Email infrastructure reuse: `enqueueEventEmail` (`src/lib/event-email.ts:12`), `resolveEmailRecipient` (`src/lib/email.ts:35-58`), `getNotificationKeys` (`src/lib/i18n-server.ts:44`), `STRINGS` constant object + internal helpers in `email-templates.ts` (file-scoped, non-exported — `HEADER_HTML`/`FOOTER_HTML`/`detailRow`/`detailTable`/`deepLinkButton`/`buildEmail`)
*   `email_queue.templateType` is a Drizzle text enum (`text('template_type', { enum: [...] })` at `src/db/schema/email-queue.ts:10`) — adding `'student_at_risk'` is a code-only change, no `ALTER TYPE` migration
*   i18n codegen — new notification keys + email subject key in both `locales/en.json` and `locales/id.json`

#### Scope Boundaries
*   **In Scope:**
    *   **Risk scoring engine:** New `src/lib/risk-scoring.ts` — pure function `computeStudentRisk(data): RiskAssessment`. Takes per-checkpoint data (state, dueDate, minConsultations, verifiedConsultationCount, submissionCount, latestSubmissionDate, reviseCount, underReviewWaitDays) and returns `{ level: 'low'|'medium'|'high', factors: RiskFactor[] }`. Overall level = highest severity among active factors. Each `RiskFactor` has `{ type, severity, category, checkpointId, description }`. Category is `'student_inaction'` (signals 1-4) or `'pending_review'` (signal 5 — instructor-side cause, labeled differently in UI)
    *   **5 risk signals (thresholds):**
        1. **Overdue checkpoint** (High, student_inaction): `state IN ('unlocked','revise') AND dueDate < NOW()` — student hasn't completed a checkpoint past its due date
        2. **Approaching deadline, no submission** (Medium, student_inaction): `state = 'unlocked' AND dueDate <= NOW()+3d AND submissionCount = 0` — student hasn't started and deadline is near
        3. **Insufficient consultations, deadline approaching** (Medium, student_inaction): `verifiedConsultations < minConsultations AND dueDate <= NOW()+7d` — student needs to schedule consultations before deadline
        4. **Repeated revise** (Medium, student_inaction): `reviseCount >= 2` for the same checkpoint — student is struggling with the content
        5. **Stalled — submitted but not reviewed beyond SLA** (Low, pending_review): `state = 'under_review' AND NOW()-latestSubmissionDate > 3 days` — student's progress stalled by slow review (instructor-side cause, labeled "stalled — pending review" in UI)
    *   **Dashboard integration (instructor):** Extend `getInstructorDashboardDataHandler` (`src/server/dashboard-instructor.server.ts:53`) with `atRiskStudents` array in the response. Batch query: join `checkpoints` + `assignments` + `assignment_students` + `users` + `consultations` (verified count) + `submissions` (count/latest) + `reviews` (revise count) for the instructor's active assignments. Filter to checkpoints in states `('unlocked', 'revise', 'under_review', 'submitted')` (skip `passed`/`locked` — no risk). Pass to `computeStudentRisk`. Return students with risk level ≥ low, sorted by severity (high → medium → low). Each entry: `{ studentName, studentId, assignmentTitle, assignmentId, riskLevel, factors[] }`
    *   **Event-driven alerts:** New `src/lib/risk-alerts.ts` exporting `checkAndFireRiskAlert(db, opts)`. Called from `submitReviewHandler` (`reviews.server.ts:220`) post-commit, advisory (try/catch), when `decision === 'revise'` OR SLA breach occurred. Fetches student checkpoint data for the assignment, calls `computeStudentRisk`, fires alert if level is medium or high. Dedup: query `notifications` table for existing `type = 'student_at_risk'` notification for this `studentId` + `assignmentId` in the last 7 days (via `params->>'assignmentId'` + `metadata.studentId`). If exists, skip. Uses `Promise.allSettled` for parallel in-app notification insert + email enqueue (matching `review-sla.ts:111-125` pattern)
    *   **Alert coverage note:** Signals 1 (overdue), 4 (repeated revise), and 5 (SLA stall) are naturally event-triggered at review time. Signals 2 (approaching deadline, no submission) and 3 (insufficient consultations) are time-based — visible on the dashboard (on-demand) but won't trigger event-driven alerts until a discrete event occurs. If TRACK-021 is implemented, its scanner naturally covers signal 2 (approaching deadlines). TRACK-023's risk scoring can be called from TRACK-021's scanner as a future enhancement for full signal coverage
    *   **Admin analytics extension:** Extend `getAdminAnalyticsDataHandler` (`analytics-admin.server.ts`) with `atRiskSummary: { high: number, medium: number, low: number }` — counts of distinct students matching each risk level across all active assignments. Uses simplified SQL (COUNT DISTINCT students matching each signal's criteria directly — no per-student risk function call). No drill-down to individual students
    *   **Dashboard widget (UI):** New component on instructor dashboard (`src/routes/_authenticated/instructor/dashboard.tsx`) — at-risk student list with risk-level `Badge` (yellow/orange/red), student name, assignment title, risk factor count + brief descriptions (via i18n), link to assignment detail (`/instructor/assignments/${assignmentId}`). Sorted by severity. Empty state: "No students at risk" (reuses `EmptyState` component from TRACK-013)
    *   **Notification type:** New `student_at_risk` type — target: instructor (the student's assignment instructor). Route: `/instructor/assignments/${meta.assignmentId}` (extended in `notification-routes.ts`). Params all strings: `studentName`, `assignmentTitle`, `riskLevel`, `riskFactors` (comma-separated type strings). Added to `system` group in `GROUP_CONFIGS` (alongside `sla_breach` — both are system-level alerts, though `sla_breach` goes to admins and `student_at_risk` goes to instructors; they won't appear in the same user's notification center)
    *   **Email template:** New `buildStudentAtRiskHtml` in `src/lib/email-templates.ts` (named `build{Event}Html` matching convention) — uses internal helpers + `STRINGS` object for body content (NOT locales JSON). Shows student name, assignment title, risk level, risk factor descriptions, CTA link to `${BETTER_AUTH_URL}/instructor/assignments/${assignmentId}`. New email helper wrapper: `src/lib/at-risk-email.ts` (`sendStudentAtRiskEmail` calling `enqueueEventEmail`, matching `review-email.ts` pattern). Email subject key: `emails.subjects.studentAtRisk` (camelCase)
    *   **Email queue enum extension:** Add `'student_at_risk'` to the `templateType` array in `src/db/schema/email-queue.ts:10` (code-only — Drizzle text enum, not pg enum, no `ALTER TYPE`)
    *   **i18n keys:** `notifications.events.student_at_risk.title`/`.message` (params: `studentName`, `assignmentTitle`, `riskLevel`), `emails.subjects.studentAtRisk`, `dashboard.atRisk.title`/`.empty`/`.factorCount`, per-factor descriptions (`dashboard.atRisk.factors.overdue_checkpoint`/`.approaching_deadline`/`.insufficient_consultations`/`.repeated_revise`/`.stalled_review`), admin analytics label `analytics.atRiskSummary`. Added to both locales, run `pnpm generate:i18n`
    *   **Unit tests:** `risk-scoring.ts` (all 5 signals in isolation, severity escalation, multi-factor aggregation, category labeling, no-risk student returns `level: 'low'` with empty factors). `risk-alerts.ts` (dedup skips when notification exists within 7 days, fires when no prior notification, advisory try/catch, `Promise.allSettled` for parallel send). Dashboard handler extension (at-risk list populated correctly, sorted by severity, passed/locked excluded). Admin analytics extension (aggregate counts correct). Email template rendering (both locales). `notification-routes.ts` route derivation for `student_at_risk`
*   **Out of Scope:**
    *   Risk history/trend tracking (no time-series of risk scores — would require a `risk_assessments` table; deferred to v2)
    *   Student-facing risk view (students don't see their own risk score — could be demotivating; v2 could add constructive "N checkpoints need attention" view)
    *   Automated interventions (no auto-extending deadlines, no auto-scheduling consultations — the system alerts, the human acts)
    *   Inline actions in at-risk widget (no "extend deadline" or "message student" buttons — instructor navigates to existing pages to act)
    *   Admin drill-down to individual at-risk students (v1 is aggregate counts only)
    *   Risk-based prioritization of TRACK-021 deadline reminders (v2 — reminders could be escalated for at-risk students)

#### High-Level Execution Vectors
*   **Phase 1 (Risk Scoring Engine):** Create `src/lib/risk-scoring.ts` with `computeStudentRisk(data): RiskAssessment`. Define types: `RiskLevel`, `RiskFactor`, `RiskCategory`, `StudentRiskInput`. Implement 5 signal checks with thresholds (overdue=high, approaching+no-submission=medium, insufficient-consultations=medium, repeated-revise=medium, SLA-stall=low). Overall level = highest active signal. Category: signals 1-4 = `'student_inaction'`, signal 5 = `'pending_review'`. Pure function — no DB access, no side effects. Write unit tests (each signal in isolation, multi-factor aggregation, severity escalation, no-risk student, category labeling). Verify: all 5 signals detect correctly, overall level is highest severity, multiple factors aggregated, pure function has no dependencies.
*   **Phase 2 (Dashboard + Event Alerts):** Extend `getInstructorDashboardDataHandler` (`dashboard-instructor.server.ts:53`) — add Group D query: batch join checkpoints + assignments + assignment_students + users + consultations (verified count) + submissions (count/latest) + reviews (revise count) for instructor's active assignments. Filter to states `('unlocked','revise','under_review','submitted')`. Pass per-student data to `computeStudentRisk`. Add `atRiskStudents` to response (students with level ≥ low, sorted high→medium→low). Create `src/lib/risk-alerts.ts` with `checkAndFireRiskAlert(db, opts)` — fetch student data, compute risk, check 7-day dedup via `notifications` table (`SELECT 1 FROM notifications WHERE type = 'student_at_risk' AND params->>'assignmentId' = ? AND metadata->>'studentId' = ? AND createdAt > NOW() - INTERVAL '7 days'`), fire in-app notification + email via `Promise.allSettled`. Call from `submitReviewHandler` (`reviews.server.ts:220`) post-commit when `decision === 'revise'` OR SLA breach occurred. Extend `getAdminAnalyticsDataHandler` (`analytics-admin.server.ts`) with `atRiskSummary` (simplified SQL counting distinct students per signal). Write tests (dashboard populates at-risk list, event-driven alert fires on revise, dedup prevents re-fire within 7 days, advisory try/catch doesn't affect review, admin aggregate counts correct). Verify: dashboard shows at-risk students sorted by severity, revise review triggers alert (if medium/high), pass review does not trigger alert, SLA breach triggers alert, dedup works, admin analytics shows aggregate counts.
*   **Phase 3 (UI, Email & i18n):** Create at-risk widget component on instructor dashboard — `Badge` (yellow/orange/red), student name, assignment title, factor count + descriptions, link to `/instructor/assignments/${assignmentId}`, `EmptyState` when no at-risk students. Add `buildStudentAtRiskHtml` to `email-templates.ts` (internal helpers, `STRINGS[locale].studentAtRisk` for intro, CTA link to `${BETTER_AUTH_URL}/instructor/assignments/${assignmentId}`). Create `src/lib/at-risk-email.ts` wrapper (`sendStudentAtRiskEmail` calling `enqueueEventEmail`). Add `'student_at_risk'` to `templateType` array in `email-queue.ts` (code-only). Extend `notification-routes.ts` `getNotificationRoute()` with `case 'student_at_risk':` returning `/instructor/assignments/${meta.assignmentId}`. Add `student_at_risk` to `system` group in `GROUP_CONFIGS`. Add i18n keys to both locales. Run `pnpm generate:i18n`. Write tests (widget renders, email renders both locales, notification route derived, `pnpm check:i18n` parity). Verify: all 5 factor descriptions display, email renders in both locales, notification is clickable, i18n parity, `reducedMotion` unaffected (no TRACK-022 coupling needed — `student_at_risk` is a new type that will be auto-included when TRACK-022 lands).

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Instructor opens dashboard → sees at-risk widget with students sorted by severity (high first). A student with an overdue checkpoint shows as "high" with factor "Overdue checkpoint" (student_inaction). A student with 2 revise reviews on the same checkpoint shows as "medium" with factor "Repeated revise". A student whose submission has been waiting 4 days for review shows as "low" with factor "Stalled — pending review" (pending_review category). A student who is on track shows nothing (not in the at-risk list). Instructor reviews a submission with `revise` decision → if the student's risk is medium/high, the instructor receives an in-app notification + email. A second `revise` on the same checkpoint within 7 days does NOT produce a duplicate alert (dedup). A `pass` review does not trigger an alert. SLA breach triggers an alert (if medium/high). Admin analytics page shows aggregate at-risk counts (X high, Y medium, Z low). In-app `student_at_risk` notifications are clickable (navigate to assignment detail). `sla_breach` notifications still go to admins only (unchanged). `student_at_risk` notifications go to instructors only.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: `computeStudentRisk` (each of 5 signals in isolation — overdue checkpoint=high, approaching+no-submission=medium, insufficient-consultations=medium, repeated-revise=medium, SLA-stall=low), multi-factor aggregation (2+ active signals → highest severity, all factors listed), category labeling (signals 1-4 = `student_inaction`, signal 5 = `pending_review`), no-risk student (all checkpoints passed → `level: 'low'`, empty `factors[]`), `checkAndFireRiskAlert` (fires when risk ≥ medium, skips when risk = low, dedup skips when notification exists within 7 days, advisory try/catch doesn't throw, `Promise.allSettled` for parallel notification+email), `getInstructorDashboardDataHandler` extension (at-risk list populated, sorted by severity, `passed`/`locked` checkpoints excluded, empty when no risk), `getAdminAnalyticsDataHandler` extension (aggregate counts correct per signal), `buildStudentAtRiskHtml` (both locales, `STRINGS` object, factor descriptions rendered), `notification-routes.ts` route for `student_at_risk`. `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** No new DB table or migration (all risk computed from existing data — checkpoint states, due dates, consultation counts, review decisions, submission timestamps). Risk score is ephemeral (never persisted — computed on-demand for dashboard, at event time for alerts). `risk-scoring.ts` is a pure function (no DB access, no side effects — unit-testable in isolation). `risk-alerts.ts` is advisory (try/catch, post-commit, never affects review transaction). Event-driven alerts fire at `submitReviewHandler` when `decision === 'revise'` OR SLA breach (not on pass — student succeeded). 7-day dedup via existing `notifications` table (no new state table). Signals 1/4/5 are event-triggered (at review time). Signals 2/3 are time-based (dashboard-only until TRACK-021 scanner available). Signal 5 labeled "stalled — pending review" (category `pending_review` — instructor-side cause distinguished from student inaction). Admin view is aggregate counts only (no drill-down). `student_at_risk` notification goes to instructor (not student, not admin). `sla_breach` notification still goes to admins only (unchanged). `student_at_risk` in `system` group of `GROUP_CONFIGS`. Email builder named `buildStudentAtRiskHtml` (matching convention). Email subject key `emails.subjects.studentAtRisk` (camelCase). `templateType` is Drizzle text enum (code-only change, no `ALTER TYPE`). All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

---

## Track Dependency Graph

```
Milestone 1: Critical Fixes
├── TRACK-001: Concurrency & Transaction Safety [no deps]
├── TRACK-002: Deadline & SLA Logic Correctness [coordinate with 001]
├── TRACK-003: Input Validation & Data Integrity [no deps]
└── TRACK-004: Email Queue Robustness [no deps]

Milestone 2: Performance & Optimization
├── TRACK-005: Database Indexes & Schema Optimization [no deps]
├── TRACK-006: Query & Data-Fetching Optimization [depends on 005]
└── TRACK-007: Session Caching & Bundle Safety [no deps]

Milestone 3: UX & Accessibility
├── TRACK-008: Critical UX Fixes (Broken Functionality) [no deps]
├── TRACK-009: Action Feedback & Loading States [no deps]
├── TRACK-010: Accessibility & i18n Compliance [no deps]
├── TRACK-011: Search Debounce & Form Validation [no deps]
├── TRACK-012: Notifications & File Management UX [depends on 010]
└── TRACK-013: Empty States, Date Display & Mobile [coordinate with 010]

Milestone 4: Quality Assurance
└── E2E-FEAT-001: E2E Testing with Playwright [no deps — requires core features]

Milestone 5: Post-Audit Enhancements
├── TRACK-014: Optimistic UI Updates for Mutations [Complete — introduces query-key factory]
├── TRACK-015: UI Hygiene & Tech-Debt Quick Wins [Complete — archived]
├── TRACK-016: Email Queue Retention & Delivery Completeness [no deps]
├── TRACK-017: Instructor Productivity: DOCX Preview & Keyboard Shortcuts [no deps]
├── TRACK-018: Event Email Notifications [Complete — no deps]
└── TRACK-019: Analytics & Reporting [no deps]

Milestone 6: New Features
├── TRACK-020: Rubric-Based Grading & Evaluation [no deps]
├── TRACK-021: Proactive Deadline Reminder System [no deps — recommended after 022]
├── TRACK-022: User Notification Preferences [Complete — no deps]
└── TRACK-023: At-Risk Student Identification [no deps — complementary to 021]
```

### Parallelization Strategy

The following track groups can be worked on simultaneously:

| Group | Tracks | Rationale |
|-------|--------|-----------|
| **A** | TRACK-001, TRACK-003, TRACK-004, TRACK-007, TRACK-008 | Fully independent — no file overlap |
| **B** | TRACK-002 + TRACK-001 | Both touch extension handlers — coordinate to avoid merge conflicts |
| **C** | TRACK-005 → TRACK-006 | Sequential — indexes must precede query optimization |
| **D** | TRACK-009, TRACK-010, TRACK-011 | Independent UX tracks — minimal file overlap |
| **E** | TRACK-012 + TRACK-010 | NotificationCenter refactor in 010 precedes notification UX in 012 |
| **F** | TRACK-013 + TRACK-010 | Both touch date formatting — coordinate i18n date changes |
| **G** | TRACK-014, TRACK-016, TRACK-017, TRACK-018, TRACK-019 | Fully independent — no file overlap (distinct domains: mutations, email ops, review UX, notifications, analytics) |
| **H** | TRACK-015 → TRACK-014 | Sequential — TRACK-015 consumed the query-key factory from TRACK-014 for useQuery conversion |
| **I** | TRACK-020 | Independent — new domain (rubrics/grading), extends completed tracks (template editor, review screen, analytics) but no concurrent work |
| **J** | TRACK-021 | Independent — extends existing email-queue polling loop + notifications, no file overlap with TRACK-020 (different domain: deadline reminders vs grading) |
| **K** | TRACK-022 | Complete — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 12 notification sites with per-type per-channel preference gating. Implemented alongside TRACK-021 so `deadline_reminder` type respects user prefs from day one |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized |

---

## Effort Summary

| Milestone | Tracks | Estimated Effort |
|-----------|:---:|:---:|
| 1: Critical Fixes | 4 | ~12 Days |
| 2: Performance & Optimization | 3 | ~7 Days |
| 3: UX & Accessibility | 6 | ~13 Days |
| 4: Quality Assurance | 1 | ~3 Days |
| 5: Post-Audit Enhancements | 6 | ~25 Days |
| 6: New Features | 4 | ~25 Days |
| **Total** | **24** | **~85 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
