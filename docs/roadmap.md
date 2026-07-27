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
- **Status:** Complete | **Audit IDs:** None (new feature) | **Deps:** None
- **Key decisions:** `grading_type` pgEnum (nullable) on `template_checkpoints` (`null`/`numeric`/`qualitative`); `checkpoints.templateCheckpointId` FK (nullable, backfilled); `rubric_criteria`/`rubric_levels` with soft-delete; `review_scores` with full denormalized snapshot (`criterionTitle`, `levelLabel`, `score`, `weight`); `updateTemplateHandler` refactored from delete+reinsert to upsert/diff (preserves checkpoint IDs); weight-sum (100%) validation at Zod application layer; live rubric lookup at review time + frozen snapshot for completed reviews; rubric analytics (avg per criterion, cross-instructor comparison, CSV/Excel export); review fixes: validation-before-insert to prevent orphaned reviews, `.returning()` for review ID, TOCTOU lock on `saveRubricHandler`, `safeAuditLog` helper, Excel injection mitigation, a11y (aria-live, accessible labels, stable React keys)
- **Detail:** `conductor/archive/rubric-based-grading-evaluation_20260723/` (spec.md, plan.md)

### TRACK-021: Proactive Deadline Reminder System
- **Status:** ✅ Complete · **Deps:** None
- **Key decisions:** Background scanner (`processDeadlineReminders()`) runs hourly via email-queue tick throttled by `lastReminderScanAt`; tiered reminders (7d/3d/1d lead times) with non-overlapping bands (`>3d`/`>1d`/`>0d`) firing in-app notifications + emails; `deadline_reminders` dedup table with unique `(checkpointId, tier)` + `ON CONFLICT DO NOTHING RETURNING *` for multi-instance safety; `checkpoints_state_due_date_idx` composite index; dedup + notification inserts wrapped in `db.transaction` (atomicity — if notification insert fails, dedup row rolls back so the tier can retry); email dispatch post-commit via `Promise.allSettled` (advisory, never throws); `deadline_reminder` added to `email_queue.templateType` Drizzle text enum (code-only, no `ALTER TYPE`); email subject `{assignmentTitle}` interpolated via `subjectParams` on `enqueueEventEmail`; scanner failure isolated via `try/catch` in `tick()` (email processing unaffected)
- **Detail:** `conductor/archive/proactive-deadline-reminders_20260723/` (spec.md, plan.md)

### TRACK-022: User Notification Preferences
- **Status:** ✅ Complete · **Deps:** None (recommended AFTER TRACK-021 — prevents `deadline_reminder` notifications from being un-mutable; TRACK-021 is now complete)
- **Key decisions:** Per-user, per-type, per-channel notification preferences stored in existing `users.settings` JSONB column (no separate table, no migration); 12 types across 4 groups (Reviews, Consultations, Submissions, System) with independent Email + In-app toggles (default all ON — opt-out); `updateUserSettingsHandler` refactored from replace to read-modify-write merge (prevents `notificationPrefs` from clobbering `reducedMotion`); email gate in `enqueueEventEmail` (skip enqueue when `notificationPrefs[type].email === false`); in-app gate via `shouldSendInAppNotification` helper at 12 creation sites; `EMAIL_GATE_EXEMPT` set for 4 security types (password_reset, invitation, two_factor, sla_alert); `notificationType` param resolves `sla_breach`↔`sla_alert` and `deadline_extended`↔`extension_approved` type mismatches; `sla_breach` email always sent to admins (bypasses gate via `enqueueEmail` direct call — email toggle hidden in UI); `maybeInsertNotification` helper reduces code duplication at 4 consultation/review sites
- **Detail:** `conductor/archive/user-notification-preferences_20260723/` (spec.md, plan.md)

### TRACK-023: At-Risk Student Identification & Early Warning System
- **Status:** ✅ Complete · **Deps:** None (complementary to TRACK-021)
- **Key decisions:** Pure function `computeStudentRisk(data): RiskAssessment` with 5 risk signals (overdue=High, approaching deadline no submission=Medium, insufficient consultations=Medium, repeated revise>=2=Medium, stalled review>3d=Low); signals 1-4=`student_inaction`, 5=`pending_review`; overall level=highest severity; ephemeral (never persisted); `checkAndFireRiskAlert` advisory post-commit (try/catch, 7-day dedup via notifications table JSON metadata, `Promise.allSettled` for parallel notification+email); `maybeFireReviewRiskAlert` called from `submitReviewHandler` when revise OR SLA breach (double try/catch safety); deadline reminder scanner integration via `Promise.allSettled`; instructor dashboard at-risk widget (sorted by severity, i18n factor descriptions via `getRiskFactorText`, `EmptyState` when none); admin analytics `atRiskSummary`{high,medium,low} with colored Badge UI (destructive/warning/info); `student_at_risk` notification type (instructor target, `system` group in `GROUP_CONFIGS`, route to `/instructor/assignments/` + assignmentId); `buildStudentAtRiskHtml` email template + `sendStudentAtRiskEmail` wrapper; `student_at_risk` added to `templateType` enum (code-only, no ALTER TYPE -- 14 values now); review fixes applied: i18n factor descriptions resolved via `getRiskFactorText` in dashboard widget, admin analytics `atRiskSummary` UI card added with Badge components + `EmptyState`
- **Detail:** conductor/archive/at-risk-student-early-warning_20260724/ (spec.md, plan.md)

### TRACK-025: Gradebook & Final Grade Computation
- **Status:** ✅ Complete · **Audit IDs:** None (new feature) · **Deps:** TRACK-020 (Rubric-Based Grading — provides `review_scores` with denormalized weight/score snapshots)
- **Key decisions:** Pure `computeFinalGrade` function (no DB access); `assignment_grade_config` (1:1 with assignments, cascade-deleted) + `final_grades` cache table (upserted, never individually deleted); auto-created default config on assignment creation + migration backfill for pre-existing assignments; `equal_weight`/`custom_weight` schemes with stale-weight fallback (sum≠100, missing/extra checkpoint entries → equal_weight + warning badge); post-commit advisory grade recomputation on `pass` review decision (try/catch, never affects review transaction); admin-only `recomputeAllGrades` wrapped in `db.transaction` for atomicity; CSV export with formula-injection mitigation (`escapeCsvValue`); client-side Excel via SheetJS (`sanitizeCell`); admin grade distribution analytics (A/B/C/D/F progress bars); review fixes applied: stale-weight detection for removed checkpoints (key-count check), `logAuditEvent` awaited in try/catch (SQL §6.4), `recomputeAllGradesHandler` transaction wrapping, redundant `computeFinalGrade`/`computeCheckpointScore` calls eliminated, migration rollback file created (SQL §5.1)
- **Detail:** `conductor/archive/gradebook-final-grade-computation_20260725/` (spec.md, plan.md)

#### Context Anchors (Traceability)
*   **PRD Reference:** `docs/PRD.md#checkpoints--submissions` (review workflow with rubric scoring — the data source for grade computation), `docs/PRD.md#analytics--reporting` (CSV/Excel export infrastructure — extension point for gradebook exports), `docs/PRD.md#data-model-summary` (`ReviewScore` entity — denormalized snapshot of criterion score/weight at review time)
*   **TDD Reference:** `docs/TDD.md` `assignments` table (`src/db/schema/assignments.ts:24` — `finalDeadline`, `instructorId`), `checkpoints` table (`src/db/schema/assignments.ts:77` — `state`, `order`, `studentId`, `templateCheckpointId`), `reviews` table (`src/db/schema/submissions.ts:41` — `decision`, `reviewedAt`), `review_scores` table (`src/db/schema/rubrics.ts:46` — `score`, `weight`, `criterionTitle`, `levelLabel` — denormalized snapshot frozen at review time), `template_checkpoints` table (`src/db/schema/templates.ts:16` — `gradingType`, `order`, `minConsultations`); `src/server/analytics-export.server.ts` (existing CSV export handlers + private `escapeCsvValue`/`buildCsv` helpers — extension point for gradebook CSV), `src/lib/excel-export.ts` (existing client-side `.xlsx` export + `exportRubricScoresToExcel` pattern — extension point for gradebook Excel), `src/server/dashboard-student.server.ts` (student dashboard handler — extension point for final grade display), `src/server/dashboard-instructor.server.ts:53-255` (`getInstructorDashboardDataHandler` — extension point for gradebook summary), `src/server/reviews.server.ts:220` (`submitReviewHandler` — event site for grade recomputation trigger; file is at 495/500 lines — extension must go in `reviews-extras.server.ts`), `src/server/assignments.server.ts:79` (`createAssignmentHandler` — where default grade config is inserted inside the transaction; file is at 498/500 lines — extension must go in `assignments-extras.server.ts`), `src/server/reviews-extras.server.ts` (existing extras file — extension point for `recomputeStudentGrade` advisory call), `src/server/assignments-extras.server.ts` (existing extras file — extension point for `createDefaultGradeConfig` helper)
*   **Product Spec Reference:** `conductor/product.md` Track: Rubric-Based Grading & Evaluation (TRACK-020) — explicitly deferred "Grade transcripts / final grade aggregation across checkpoints (separate future track)" in Out of Scope section of `conductor/archive/rubric-based-grading-evaluation_20260723/spec.md`

#### Track Tech Stack
*   Drizzle ORM — New `assignment_grade_config` table (weighting scheme per assignment) and `final_grades` table (cached computed grade per student per assignment). New schema file `src/db/schema/gradebook.ts`, registered in `src/db/schema/index.ts` re-exports + relations. Migration generated via `pnpm db:generate`. Neither table uses `deletedAt` soft-delete — `assignment_grade_config` is 1:1 with assignments (cascade-deleted via FK), `final_grades` is a cache (upserted, never deleted individually).
*   New shared module: `src/lib/grade-computation.ts` — pure functions, no DB access. Exports `computeFinalGrade(checkpoints: CheckpointGradeInput[], config: AssignmentGradeConfig): FinalGradeResult` and types (`GradingScheme = 'equal_weight' | 'custom_weight'`, `CheckpointGradeInput`, `FinalGradeResult = { score: number | null, letterGrade: string | null, status: 'complete' | 'incomplete' | 'in_progress', contributingCheckpoints: ContributingCheckpoint[] }`, `ContributingCheckpoint = { checkpointId: number, checkpointName: string, templateCheckpointId: number | null, order: number, state: string, score: number, isRubric: boolean, weight: number }`). Called from server handlers (on-demand computation) and cached in `final_grades` table.
*   New server function split: `src/server/gradebook.ts` (client-safe Zod schemas + `createServerFn` stubs with `.inputValidator(Schema).handler(...)` builder pattern) + `src/server/gradebook.server.ts` (handler implementations — `getStudentFinalGradeHandler`, `getAssignmentGradebookHandler`, `saveGradeConfigHandler`). Note: `exportGradebookCsvHandler` lives in `analytics-export.server.ts` (see below), NOT in `gradebook.server.ts`.
*   Existing file extension: `src/server/analytics-export.server.ts` (355 lines, has room) — add `exportGradebookCsvHandler` (admin-only, per-assignment gradebook with ownership check). Uses the file's existing private `escapeCsvValue` and `buildCsv` helpers directly (no export needed — same file).
*   Existing file extension: `src/lib/excel-export.ts` (64 lines) — add `exportGradebookToExcel` helper (client-side `.xlsx` with human-readable column headers, matching existing `exportRubricScoresToExcel` pattern). Uses existing `sanitizeCell` for formula-injection mitigation.
*   Existing file extension: `src/server/reviews-extras.server.ts` — add `recomputeStudentGrade(db, assignmentId, studentId)` helper function. Called from `submitReviewHandler` post-commit advisory section (1-line call + try/catch = ~5 lines added to `reviews.server.ts` which is at 495/500 — tight but fits).
*   Existing file extension: `src/server/assignments-extras.server.ts` — add `createDefaultGradeConfig(tx, assignmentId)` helper. Called from `createAssignmentHandler` inside the transaction (1-line call — `assignments.server.ts` is at 498/500, 1 line fits).
*   shadcn/ui components — `Table` for gradebook grid (students × checkpoints → final grade), `Badge` for letter grades, `Card`/`CardHeader`/`CardContent` for student final grade card, `Input` for custom weight configuration, `Select` for grading scheme selector.
*   i18n codegen — new gradebook keys in both `locales/en.json` and `locales/id.json` under `gradebook.*` namespace.

#### Scope Boundaries
*   **In Scope:**
    *   **Grade configuration schema:** New `assignment_grade_config` table — `assignmentId` (integer, FK → assignments, unique, `onDelete: cascade`), `gradingScheme` (pgEnum: `equal_weight` | `custom_weight`), `customWeights` (jsonb, nullable — `{ templateCheckpointId: weight }` map, used only when scheme is `custom_weight`; keys are `templateCheckpointId` integers as strings, values are integer weights 0–100), `letterGradeBounds` (jsonb — `{ "A": 90, "B": 80, "C": 70, "D": 60 }` configurable lower bounds; score below the lowest bound → "F" implicitly), `createdAt` (timestamp), `updatedAt` (timestamp). Default config auto-created inside `createAssignmentHandler` transaction via `createDefaultGradeConfig(tx, assignmentId)` helper in `assignments-extras.server.ts` (scheme = `equal_weight`, `customWeights` = null, standard letter bounds). For pre-existing assignments (created before this track), a **migration script** backfills default config rows — NOT lazy creation on read.
    *   **Final grades cache table:** New `final_grades` table — `id` (serial PK), `assignmentId` (integer, FK → assignments, `onDelete: cascade`), `studentId` (text, FK → users), `numericScore` (numeric(5,2), nullable — null if incomplete), `letterGrade` (text, nullable), `status` (pgEnum: `complete` | `incomplete` | `in_progress`), `contributingCheckpoints` (jsonb — array of `{ checkpointId: number, checkpointName: string, templateCheckpointId: number | null, order: number, state: string, score: number, isRubric: boolean, weight: number }`), `computedAt` (timestamp), `updatedAt` (timestamp). Unique constraint on `(assignmentId, studentId)`. Recomputed on-demand or when a review is submitted (triggered from `submitReviewHandler` post-commit via `recomputeStudentGrade` in `reviews-extras.server.ts`).
    *   **Grade computation engine:** New `src/lib/grade-computation.ts` — pure function `computeFinalGrade(checkpoints, config): FinalGradeResult`. For each checkpoint: if `gradingType` is `null` (pass/fail), score = `state === 'passed'` ? 100 : 0; if `numeric`/`qualitative`, aggregate `review_scores` weighted by criterion `weight` (using denormalized snapshot values — sum of `score * weight / 100` per criterion). Overall score = weighted average of checkpoint scores using the configured scheme: `equal_weight` = simple average (sum / count), `custom_weight` = weighted by `customWeights` map (keyed by `templateCheckpointId`). Letter grade derived from `letterGradeBounds` (score >= bound → that letter; score below lowest bound → "F"). Status: `complete` if all checkpoints passed, `in_progress` if some passed, `incomplete` if none passed.
    *   **Instructor gradebook view:** New route `/instructor/assignments/$id/gradebook` — table view (students × checkpoints → final grade column). Each cell shows the checkpoint's computed score (or pass/fail badge for non-rubric checkpoints). Final grade column shows numeric score + letter badge. Export CSV and Excel buttons. Linked from the instructor assignment detail page. (Grade Settings dialog is admin-only — see below.)
    *   **Admin grade settings dialog:** "Grade Settings" dialog accessible from the admin template editor or admin analytics — `Select` for scheme, `Input` fields for custom weights (visible only when `custom_weight` selected, keyed by `templateCheckpointId`), `Input` fields for letter bounds. Admin-only (consistent with rubric ownership per TRACK-020 — rubrics are admin-owned, grade config follows the same pattern). `saveGradeConfigHandler` is admin-only via `isAdmin` guard.
    *   **Student final grade card:** New component on `/student/assignments/$id` — shows final grade (numeric + letter badge) when the assignment is complete, or current progress score with "in progress" status. Per-checkpoint score breakdown in a collapsible section. Read-only for students.
    *   **Admin grade overview:** Extend admin analytics (`/admin/analytics`) with a "Grade Distribution" section — aggregate letter grade distribution across all assignments (A/B/C/D/F counts as progress bars). No drill-down to individual students (v2).
    *   **CSV/Excel export:** `exportGradebookCsvHandler` in `analytics-export.server.ts` (admin-only, per-assignment, ownership-verified) returns CSV string with student name, per-checkpoint scores, final numeric score, letter grade. Uses existing private `escapeCsvValue` and `buildCsv` in the same file. Client-side `exportGradebookToExcel` helper in `excel-export.ts` for `.xlsx` export, using existing `sanitizeCell`.
    *   **Grade recomputation trigger:** Extend `submitReviewHandler` (`reviews.server.ts:220`) post-commit advisory section with a call to `recomputeStudentGrade(db, assignmentId, studentId)` (defined in `reviews-extras.server.ts`, try/catch, never affects review transaction). Only triggers on `pass` decision (revise doesn't change pass state). NOT triggered on `submitCheckpointHandler` (submitting doesn't change pass state — grade only changes when a checkpoint transitions to `passed`).
    *   **Audit logging:** All grade config changes (scheme, custom weights, letter bounds) logged to `audit_log` via `logAuditEvent` with action `gradebook.config_updated`, entity type `assignment_grade_config`, details including previous and new values. Consistent with existing audit logging for template/rubric changes.
    *   **Schema registration:** New `src/db/schema/gradebook.ts` file registered in `src/db/schema/index.ts` re-exports + relations (`assignmentGradeConfigRelations`, `finalGradesRelations`).
    *   **i18n keys:** `gradebook.title`, `gradebook.finalGrade`, `gradebook.letterGrade.*` (A/B/C/D/F labels), `gradebook.status.complete`/`.in_progress`/`.incomplete`, `gradebook.settings.scheme`/`.equalWeight`/`.customWeight`, `gradebook.settings.letterBounds`, `gradebook.settings.customWeights`, `gradebook.exportCsv`/`.exportExcel`, `gradebook.empty`/`.noGrades`, `analytics.gradeDistribution`. Added to both locales, run `pnpm generate:i18n`.
    *   **Unit tests:** `grade-computation.ts` (2 schemes in isolation — equal_weight, custom_weight; pass/fail checkpoints vs rubric-scored checkpoints; incomplete assignments; letter grade boundary edge cases — score exactly 90 → "A", score 89.99 → "B", score below D bound → "F"; all-passed → complete, none-passed → incomplete, mixed → in_progress; null gradingType checkpoints scored as pass=100/fail=0; custom_weights keyed by templateCheckpointId). `getStudentFinalGradeHandler` (returns computed grade, returns null when no config exists, ownership verified). `getAssignmentGradebookHandler` (returns all students with per-checkpoint scores, sorted by student name, instructor ownership verified). `exportGradebookCsvHandler` (CSV format correct, formula injection mitigated via `escapeCsvValue`, admin ownership verified). `saveGradeConfigHandler` (admin-only, validates custom weights sum to 100 when scheme is `custom_weight` via `superRefine`, upserts config, audit logs the change). Grade recomputation trigger (fires post-commit on `submitReviewHandler` with `pass` decision, advisory try/catch doesn't throw, upserts `final_grades` row, doesn't affect review transaction, does NOT fire on `revise` decision).
*   **Out of Scope:**
    *   Grade appeals workflow (no formal appeal request/approval flow — v2)
    *   Cross-assignment grade aggregation / transcript generation (v2 — requires course/semester grouping from the proposed Course & Semester track)
    *   GPA computation (v2 — requires institution-specific GPA scales)
    *   Student-facing grade editing or grade negotiation (grades are computed, read-only for students)
    *   Weighted checkpoint categories (e.g., "homework = 30%, exams = 70%" — v2; v1 weights are per-checkpoint, not per-category)
    *   Grade history/audit trail (no time-series of grade changes — `final_grades` is upserted, not append-only; v2 could add `final_grade_history` table)
    *   Automated grade import from external systems (LMS integration — v2)
    *   Student notification on grade update (v2 — students see their grade when they open the assignment page; no push notification for grade changes)
    *   `passThreshold` / numeric pass override (the instructor's pass/revise decision already determines checkpoint completion — a numeric threshold would conflict with instructor judgment)

#### High-Level Execution Vectors
*   **Phase 1 (Schema & Computation Engine):** Create `src/db/schema/gradebook.ts` with `assignment_grade_config` and `final_grades` tables — proper FKs (`assignmentId` → assignments `onDelete: cascade`, `studentId` → users), unique constraints (`assignment_grade_config_assignment_id_unq`, `final_grades_assignment_id_student_id_unq`), and indexes. `numericScore` as `numeric(5,2)`. No `deletedAt` on either table (cascade-deleted with assignment / cache upserted). Register in `src/db/schema/index.ts` re-exports + relations. Generate migration via `pnpm db:generate` — migration includes backfill of default `assignment_grade_config` rows for all existing assignments. Create `src/lib/grade-computation.ts` with `computeFinalGrade(checkpoints, config): FinalGradeResult`. Define types: `GradingScheme` (`'equal_weight' | 'custom_weight'`), `CheckpointGradeInput`, `FinalGradeResult`, `ContributingCheckpoint`, `AssignmentGradeConfig`. Implement 2 schemes: `equal_weight` (simple average of checkpoint scores), `custom_weight` (weighted by `customWeights` map keyed by `templateCheckpointId`). For each checkpoint: if `gradingType === null`, score = `state === 'passed'` ? 100 : 0; if `numeric`/`qualitative`, aggregate `review_scores` (sum of `score * weight / 100` per criterion, using denormalized snapshot). Letter grade from `letterGradeBounds` (score >= bound → letter; below lowest bound → "F"). Status: all passed → `complete`, none passed → `incomplete`, mixed → `in_progress`. Pure function — no DB access. Write unit tests (each scheme in isolation, pass/fail vs rubric checkpoints, incomplete assignments, letter grade boundaries including "F" fallback, custom_weights keyed by templateCheckpointId, null config defaults). Verify: both schemes compute correctly, pass/fail checkpoints scored as 100/0, rubric checkpoints use denormalized snapshot, letter grades derived from configurable bounds with "F" fallback, status reflects completion state.
*   **Phase 2 (Server Functions & Grade Recomputation):** Create `src/server/gradebook.ts` (Zod schemas: `GetStudentFinalGradeSchema`, `GetAssignmentGradebookSchema`, `SaveGradeConfigSchema` with `superRefine` for custom weight sum validation) + `createServerFn` stubs with `.inputValidator(Schema).handler(...)` pattern. Create `src/server/gradebook.server.ts` with handlers: `getStudentFinalGradeHandler` (ownership-verified, returns computed grade or null — does NOT auto-create config; reads from `final_grades` cache or computes on-demand if cache is stale), `getAssignmentGradebookHandler` (instructor ownership-verified, returns all students with per-checkpoint scores via batch query joining checkpoints + reviews + review_scores, passes to `computeFinalGrade`), `saveGradeConfigHandler` (admin-only via `isAdmin` guard, validates custom weights sum to 100 when scheme is `custom_weight`, upserts config, audit logs via `logAuditEvent`). Add `exportGradebookCsvHandler` to `analytics-export.server.ts` (admin-only, ownership-verified, uses existing private `escapeCsvValue` + `buildCsv`). Add `recomputeStudentGrade(db, assignmentId, studentId)` to `reviews-extras.server.ts` — fetches student checkpoint data, calls `computeFinalGrade`, upserts `final_grades` row. Add `createDefaultGradeConfig(tx, assignmentId)` to `assignments-extras.server.ts` — inserts default `assignment_grade_config` row. Extend `submitReviewHandler` post-commit advisory section with 1-line call to `recomputeStudentGrade` (wrapped in try/catch, only when `decision === 'pass'`). Extend `createAssignmentHandler` inside transaction with 1-line call to `createDefaultGradeConfig(tx, assignmentId)`. Write tests (all handlers: success + ownership + validation failure cases; recomputation trigger: fires post-commit on pass, does NOT fire on revise, advisory, upserts `final_grades` row, doesn't affect review transaction; default config creation: fires inside assignment creation transaction). Verify: gradebook returns correct per-student scores, CSV export is sanitized, config save validates custom weights and audit logs, grade recomputes after pass review, default config created with assignment.
*   **Phase 3 (UI, Export & i18n):** Create instructor gradebook route `/instructor/assignments/$id/gradebook` — `Table` with students as rows, checkpoints as columns, final grade as last column. Each cell: numeric score (rubric checkpoints) or pass/fail `Badge` (non-rubric). Final grade column: numeric score + letter `Badge`. Export CSV + Excel buttons (reuse existing `useCsvDownload` hook + `downloadCsv` utility from `src/lib/download.ts`). Create admin grade settings dialog — `Select` for scheme, `Input` fields for custom weights (visible only when `custom_weight` selected, labeled by checkpoint name), `Input` fields for letter bounds. Create student final grade card component on `/student/assignments/$id` — `Card` with numeric score + letter `Badge`, collapsible per-checkpoint breakdown, read-only. Extend admin analytics with "Grade Distribution" section (progress bars for A/B/C/D/F counts via aggregate query). Add i18n keys to both locales. Run `pnpm generate:i18n`. Write tests (gradebook table renders, settings dialog validates, student card shows/hides correctly, admin distribution renders, CSV/Excel export triggers). Verify: gradebook shows all students with scores, admin settings dialog saves config, student sees final grade when complete, admin sees distribution, CSV/Excel export works, i18n parity, all files under 500 lines.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Instructor opens `/instructor/assignments/$id/gradebook` → sees a table of all assigned students with per-checkpoint scores and a final grade column. A student with all checkpoints passed shows a numeric score (e.g., 87.50) and letter badge (e.g., "B"). A student with incomplete checkpoints shows "In Progress" status. Admin opens Grade Settings dialog → changes scheme from "Equal Weight" to "Custom Weight" → enters custom weights per checkpoint (must sum to 100%) → saves → gradebook recalculates. Admin clicks "Export CSV" → downloads a `.csv` file with student names, checkpoint scores, and final grades. Student opens `/student/assignments/$id` → sees a final grade card with their score and letter badge (when assignment is complete) or "In Progress" (when incomplete). Student clicks the breakdown → sees per-checkpoint scores. Admin opens `/admin/analytics` → sees a "Grade Distribution" section with A/B/C/D/F progress bars. Instructor reviews a submission with `pass` decision → the student's final grade in the gradebook updates to reflect the newly passed checkpoint. A `revise` review does NOT trigger grade recomputation. Backward compatibility: pre-existing assignments have default `assignment_grade_config` rows backfilled by the migration script (not lazy-created on read). A new assignment created after this track automatically gets a default config row (inside the creation transaction).
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. New tests for: `computeFinalGrade` (2 schemes in isolation — equal_weight simple average, custom_weight weighted by templateCheckpointId; pass/fail checkpoints scored as 100/0, rubric checkpoints use `review_scores` denormalized snapshot; incomplete assignment → status `incomplete`, mixed → `in_progress`, all passed → `complete`; letter grade boundary edge cases — score exactly 90 → "A", score 89.99 → "B", score 59.99 → "F"; null config → uses defaults), `getStudentFinalGradeHandler` (returns computed grade, returns null when no config exists, ownership verified — student cannot access another student's grade, does NOT auto-create config on read), `getAssignmentGradebookHandler` (returns all students with per-checkpoint scores, sorted by name, instructor ownership verified), `exportGradebookCsvHandler` (CSV format correct — headers, student rows, formula injection mitigated via `escapeCsvValue`, admin ownership verified), `saveGradeConfigHandler` (admin-only — rejects instructor/student, validates custom weights sum to 100% via `superRefine` when scheme is `custom_weight`, upserts config, audit logs the change via `logAuditEvent`), `recomputeStudentGrade` (fires post-commit on `submitReviewHandler` with `pass` decision, does NOT fire on `revise`, advisory try/catch doesn't throw, upserts `final_grades` row, doesn't affect review transaction), `createDefaultGradeConfig` (inserts default config inside assignment creation transaction, scheme = `equal_weight`, customWeights = null, standard letter bounds). `pnpm check:i18n` — parity for all new keys. `pnpm test:coverage` >= 80% on all thresholds.
*   [ ] **Conductor Review:** New `assignment_grade_config` and `final_grades` tables in `src/db/schema/gradebook.ts`, registered in `src/db/schema/index.ts` re-exports + relations. Neither table has `deletedAt` (cascade-deleted with assignment / cache upserted). `numericScore` is `numeric(5,2)`. `gradingScheme` is a pgEnum with 2 values (`equal_weight` | `custom_weight`) — no redundant `rubric_aggregate`. No `passThreshold` column (instructor's pass/revise decision determines checkpoint completion). `customWeights` jsonb keyed by `templateCheckpointId` (string keys, integer values). `letterGradeBounds` jsonb with A/B/C/D lower bounds; "F" is implicit fallback below lowest bound. `contributingCheckpoints` jsonb has defined shape (`{ checkpointId, checkpointName, templateCheckpointId, order, state, score, isRubric, weight }`). `grade-computation.ts` is a pure function (no DB access, no side effects — unit-testable in isolation). Grade recomputation is advisory (try/catch, post-commit, only on `pass` decision, never affects review transaction) — lives in `reviews-extras.server.ts`, called with 1 line from `submitReviewHandler`. Default config creation lives in `assignments-extras.server.ts`, called with 1 line from `createAssignmentHandler` inside the transaction. Pre-existing assignments backfilled by migration script (not lazy-created on read). `exportGradebookCsvHandler` lives in `analytics-export.server.ts` (same file as `escapeCsvValue`/`buildCsv` — no export needed). `saveGradeConfigHandler` is admin-only (consistent with rubric ownership per TRACK-020). Grade config changes audit-logged via `logAuditEvent`. `review_scores` denormalized snapshot used for computation (not live rubric lookup — ensures historical grades are frozen). Excel export uses existing `xlsx` dependency + `sanitizeCell` (no new dependency). All server functions follow two-file split with `.inputValidator(Schema).handler(...)` builder pattern. All files under 500 lines. `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n` all clean.

---

### TRACK-026: Checkpoint Discussion / Q&A Threads
- **Status:** ✅ Complete · **Audit IDs:** None (new feature) · **Deps:** None
- **Key decisions:** New `checkpoint_discussions` table (self-referencing `parentMessageId` for threaded replies, soft-delete via `deletedAt`); 3 indexes (`(checkpointId, createdAt ASC)`, `(assignmentId, createdAt DESC)`, `(parentMessageId)`); two-file split (`discussions.ts` + `discussions.server.ts`) with 3 handlers (list paginated 20/page, post with notification+email, delete with 15-min window); ownership guards (student owns checkpoint OR instructor owns assignment); `discussion_reply` notification type via `metadata.target` route derivation, added to `consultations` group with `MessageCircle` icon; `'discussion_reply'` added to `email_queue.templateType` enum (code-only) + `TemplateType` union; `buildDiscussionReplyHtml` email template + `sendDiscussionReplyEmail` wrapper; `DiscussionPanel` component (optimistic mutations, 30s refetchInterval, ScrollArea, Avatar, role-based alignment) mounted on student checkpoint + instructor assignment detail (Discussions tab) + instructor review detail; `discussionKeys` factory; review fixes: migration rollback file, post-commit email try/catch (§6.4), aria-label fix, reply button hidden on deleted messages
- **Detail:** `conductor/archive/checkpoint-discussion-qa-threads_20260725/` (spec.md, plan.md)

---

## Milestone 7: Infrastructure & Tooling

> This milestone addresses proactive infrastructure and tooling upgrades that improve developer experience, build performance, and toolchain currency. These tracks are not audit-driven — they are technology refresh initiatives.

---

### TRACK-024: TypeScript 7 Upgrade

- **Status:** `Complete`
- **Dependencies:** None
- **Estimated Effort:** 1 Day / 0.5 Sprint Loops
- **Audit IDs:** None (proactive infrastructure upgrade, not audit-driven)
- **Completed:** 2026-07-23 (Conductor track `typescript-7-upgrade_20260723`, archived to `conductor/archive/`)
- **Decisions:**
  - **Direct upgrade path (5.8 → 7.0):** The project is on TypeScript `^5.8.0`. Microsoft recommends going through TS 6.0 as a bridge, but the project's tsconfig is already 95% TS 7-ready. The only deprecated option in use is `baseUrl: "."` (removed in TS 7). Since `paths` already uses `./src/*` (relative to project root), removing `baseUrl` is a trivial 1-line change with zero functional impact. A direct upgrade is low-risk.
  - **No Compiler API consumers (confirmed):** Grep across all `.ts/.tsx/.js/.mjs/.cjs` files confirmed zero direct imports of the `typescript` package. The toolchain is fully decoupled from the TS compiler API: oxlint uses its own parser (not typescript-eslint), Vitest transforms via Vite/esbuild, tsx is esbuild-based, and drizzle-kit has its own TS parser. The biggest blocker for most projects (tooling that `import`s from `typescript`) does not apply.
  - **No blocked frameworks:** No Vue, Svelte, Astro, MDX, or Angular — all of which need the compiler API for template type-checking and are blocked on TS 7.1. Pure React 19 + TanStack Start.
  - **tsc is type-checking only:** The project uses `tsc --noEmit --incremental` exclusively. Transpilation is handled by Vite/esbuild. No emit path, no downleveling concerns. TS 7's removal of `target: es5` and `module: amd/umd/systemjs/none` is irrelevant.
  - **`tsconfig.tsbuildinfo` deletion:** The Go compiler's incremental artifacts are incompatible with the JS compiler's. Must be deleted before the first TS 7 run.
  - **`noUncheckedSideEffectImports` default change:** TS 7 defaults this to `true` — may surface new errors for side-effect imports with typos. Beneficial, but watch during triage.
  - **No `@typescript/typescript6` side-by-side needed:** The project has no tooling that imports the TS compiler API, so the compatibility shim package is unnecessary. `tsc` alone suffices.
  - **Expected gains:** 8–12x faster `pnpm typecheck` (the pre-push gate), faster editor/language server experience, new `--checkers`/`--builders` flags for CI parallelism tuning, and a rebuilt `--watch` mode (Parcel-based file watcher).

#### Completion Summary

- **TypeScript version:** `^5.8.0` → `^7.0.0` (resolved to 7.0.2). Native Go compiler port.
- **tsconfig.json:** Removed `baseUrl: "."` (removed in TS 7). Path alias `"@/*": ["./src/*"]` resolves relative to project root — zero functional impact.
- **tsconfig.tsbuildinfo:** Deleted (incompatible incremental cache format between JS and Go compilers). Regenerated by first TS 7 run.
- **CI typecheck gate (`lefthook.yml`):** Pre-push typecheck updated from `pnpm typecheck` to `pnpm exec tsc --noEmit --incremental --checkers 4` — explicitly enables TS 7 shared-memory multithreading with 4 workers (TS 7 default).
- **Benchmark:** `pnpm typecheck` median time: **8.85s (TS 5.8) → 1.40s (TS 7.0.2)** — **~6.3x speedup** (slightly below the 8–12x estimate, likely due to incremental cache being warm for both measurements).
- **Quality gates (all pass under TS 7):** `pnpm typecheck` (0 errors), `pnpm test:coverage` (299 files, 2937 tests; coverage Stmts 88.26%, Branches 81.9%, Functions 84.08%, Lines 88.88% — all ≥80%), `pnpm lint` (0 warnings, 0 errors across 272 files), `pnpm check:i18n` (EN↔ID parity confirmed, 629 keys used / 762 in each locale).
- **Smoke tests:** `pnpm dev` (dev server starts, i18n codegen passes, Vite ready in ~1.8s), `pnpm build` (client build 3918 modules in 3.08s, SSR build 1116 modules in 1.74s, migrate/seed bundles generated).
- **Config verification tests:** Added `tests/unit/config/typescript-7-upgrade.test.ts` (4 tests: no `baseUrl` in tsconfig, TS version ≥7.0, `--checkers` flag in lefthook.yml, paths alias regression guard).
- **Code commits:** `1827970` (TS upgrade + baseUrl removal), `3d31fb4` (--checkers flag), `1fa5742` (config verification tests).
- **No regressions:** All 2937 existing tests pass unchanged. `noUncheckedSideEffectImports` (new TS 7 default) surfaced zero side-effect import typos.

#### Context Anchors (Traceability)

- **PRD Reference:** N/A (infrastructure upgrade, no product impact)
- **TDD Reference:** N/A (no architecture change — type-checking logic is structurally identical between TS 6.0 and 7.0)
- **Toolchain Reference:** `package.json` (devDependencies), `tsconfig.json`, `AGENTS.md` (developer commands)

#### Track Tech Stack

- TypeScript 7.0 (native Go port — `typescript` npm package, `latest` tag)
- `tsconfig.json` (remove `baseUrl`, verify all other options are TS 7-compatible)
- `pnpm` (package manager)
- CI type-checking (`--checkers`, `--builders` flags for parallelism tuning)

#### Scope Boundaries

- **In Scope:**
  - Remove `baseUrl: "."` from `tsconfig.json` (paths `@/*` → `./src/*` already relative to project root — no functional impact).
  - Update `package.json`: `"typescript": "^5.8.0"` → `"^7.0.0"`.
  - Delete `tsconfig.tsbuildinfo` (incompatible incremental format between JS and Go compilers).
  - Run `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` — triage any errors from new strict defaults or removed options.
  - Verify `noUncheckedSideEffectImports: true` (new default) doesn't surface side-effect import typos.
  - Optionally tune CI `--checkers N` for type-checking parallelism (default 4).
- **Out of Scope:**
  - TypeScript 6.0 bridge upgrade (unnecessary — tsconfig is already clean enough for direct upgrade)
  - `@typescript/typescript6` side-by-side install (no compiler API consumers to bridge)
  - VS Code extension changes (developer preference, not a project config change)
  - Refactoring code to accommodate new strict defaults (none expected — `strict: true` already set)

#### High-Level Execution Vectors

- **Phase 1 (Config reconciliation):** Remove `baseUrl: "."` from `tsconfig.json`. Verify all other tsconfig options against the TS 7 removed-options list (`target: es5`, `moduleResolution: node/node10/classic`, `module: amd/umd/systemjs/none`, `downlevelIteration`, `esModuleInterop: false`, `alwaysStrict: false`, `module` keyword in namespaces, `assert` import attributes, `ignoreDeprecations`). All confirmed absent via grep audit.
- **Phase 2 (Install & typecheck):** Delete `tsconfig.tsbuildinfo`. Update `package.json` TypeScript version to `^7.0.0`. Run `pnpm install`. Run `pnpm typecheck` — triage any errors. Expected: none (config already matches all TS 7 defaults). If `noUncheckedSideEffectImports` surfaces side-effect import issues, fix the import typos.
- **Phase 3 (Full verification):** Run `pnpm test` (unit + integration), `pnpm lint`, `pnpm build`. Verify all gates pass. Optionally benchmark `pnpm typecheck` before/after to document the speedup. Optionally tune `--checkers N` in CI for parallelism.

#### Verification & Definition of Done (DoD)

- [x] **Manual Checkpoint:** `pnpm typecheck` passes on TS 7.0 with no errors. `pnpm test` (unit + integration) — all pass. `pnpm build` — prod build succeeds (codegen + vite build + migrate/seed bundles). `pnpm dev` — dev server starts, HMR works, editor shows TS 7 language server. Measure `pnpm typecheck` time before (TS 5.8) and after (TS 7.0) — document the speedup.
- [x] **Automated Tests:** `pnpm test:unit` — all existing tests pass unchanged (type-checking logic is structurally identical between TS 6.0 and 7.0). `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors. `pnpm check:i18n` — parity maintained.
- [x] **Conductor Review:** `tsconfig.json` has no `baseUrl`. `tsconfig.tsbuildinfo` deleted and regenerated by TS 7. No deprecated/removed tsconfig options remain (grep for `baseUrl`, `target: es5`, `moduleResolution: node`, `module: amd/umd/systemjs`, `downlevelIteration`, `ignoreDeprecations` — all zero). `package.json` TypeScript version is `^7.0.0`. No `@typescript/typescript6` dependency added (not needed). All pre-push gates pass (`pnpm typecheck` && `pnpm vitest run --coverage`).

---

## Milestone 8: E2E Coverage Expansion

> This milestone addresses gaps identified in a comprehensive E2E test audit conducted after Milestone 4 (E2E-FEAT-001) and all subsequent feature tracks. The audit found that the existing 5-spec, 14-test suite covers only 10 of 30 page routes (33%) and leaves several core business flows with zero E2E coverage. Tracks are split by criticality: TRACK-027 covers P0 gaps in untested core flows, TRACK-028 covers P1/P2 breadth and infrastructure quality. Both tracks build on the Playwright infrastructure established in E2E-FEAT-001.

---

### TRACK-027: Critical Business Flow E2E Coverage

- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit) · **Deps:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure)
- **Key decisions:** 3 new E2E specs (consultation lifecycle, extension workflow, password setup); seed data expanded with student2 (enrolled) + student3 (not enrolled) + pending consultation; instructor-review tests decoupled (each sets up own state via `createSubmissionForCheckpoint`); notification delivery assertions added to existing specs; upload UI validation (file type + size); negative test cases (invalid login, locked checkpoint, cross-student access denial, superadmin role-creation rule); shared `tests/e2e/helpers/notifications.ts` extracted from duplicated helpers; non-null assertions replaced with guard clauses; template literals without interpolation replaced with single quotes
- **Detail:** `conductor/archive/critical-business-flow-e2e-coverage_20260726/` (spec.md, plan.md)

---

### TRACK-028: E2E Breadth & Infrastructure Expansion

- **Status:** ✅ Complete · **Audit IDs:** None (proactive testing gap remediation — identified in E2E audit) · **Deps:** E2E-FEAT-001 (E2E Testing with Playwright — provides infrastructure). Recommended AFTER TRACK-027.
- **Key decisions:** Expanded E2E coverage from 14→73 tests (chromium) across 14 spec files; route coverage from 10/30→28/31; added Firefox + mobile-chrome (Pixel 7) Playwright projects; integrated `@axe-core/playwright` for automated WCAG 2.1 AA accessibility scanning on 6 key pages; fixed 8 critical/serious a11y violations (color contrast on muted-foreground/sidebar/warning/success/info colors, aria-progressbar-name, label on discussion textarea, button-name on select triggers); fixed Firefox `NS_BINDING_ABORTED` by adding `waitForLoadState('networkidle')` in `loginAsRole`; `retries: 1` (2 in CI); cross-role lifecycle integration test; settings hub tests; rubric grading test; discussion Q&A tests; added second instructor to seed data for reassignment tests
- **Detail:** `conductor/archive/e2e-breadth-and-infrastructure-expansion_20260726/` (spec.md, plan.md)

---

## Milestone 9: Client Architecture Consistency

> This milestone addresses client-side data-fetching architectural inconsistencies identified after the completion of the gradebook feature (TRACK-025). The TanStack Query architecture established in TRACK-014 (query-key factory + `useQuery`/`useMutation` with optimistic updates) is followed by most domains, but two gaps were identified: (1) ~~the query-key factory covers only 7 of ~13 data domains, with 5 settings components and the entire gradebook feature using inline string-array keys or pre-React-Query `useState`/`useEffect` patterns~~ **[CLOSED — TRACK-029 complete: factory now covers 9 domains, all inline keys migrated]**, and (2) ~~the NotificationCenter reimplements infinite-scroll pagination by hand instead of using TanStack Query's native `useInfiniteQuery`~~ **[CLOSED — TRACK-030 complete: migrated to `useInfiniteQuery`, fixed latent optimistic-mutation no-op bug]**. These tracks are consistency/tech-debt work — no new product features, no backend changes, no schema migrations.

---

### TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency
- **Status:** ✅ Complete · **Audit IDs:** None (architectural consistency / tech-debt remediation) · **Deps:** TRACK-014 (query-key factory)
- **Key decisions:** Added `settingsKeys` (4 sub-keys: `currentUser`, `activeSessions`, `twoFactorStatus`, `accessibility`) and `gradebookKeys` (`studentFinalGrade(assignmentId)` only — gradebook route uses SSR loader, not TanStack Query) to `src/lib/query-keys.ts`; migrated 5 settings components from inline `['...']` keys to factory calls; fixed `ProfileSection` missing `onSettled` invalidation bug (name update didn't refetch); migrated `StudentFinalGradeCard` from `useState`+`useEffect` to `useQuery`; migrated `RecomputeGradesButton` from `useState(loading)`+inline async to `useMutation` with dual invalidation (`queryClient.invalidateQueries` + `router.invalidate()` — the latter for SSR loader data); Phase 3 audit confirmed zero inline query keys remaining in `src/**/*.tsx`; review fix: replaced `as any` type assertions with `vi.mocked()` in test file per TypeScript styleguide
- **Detail:** `conductor/archive/query-key-factory-completion_20260726/` (spec.md, plan.md)

---

### TRACK-030: NotificationCenter Infinite Query Migration
- **Status:** ✅ Complete · **Audit IDs:** None (architectural consistency / tech-debt remediation) · **Deps:** TRACK-014 (query-key factory — `notificationKeys`), TRACK-012 (Notifications & File Management UX — introduced "Load More" pagination pattern)
- **Key decisions:** Migrated `useNotificationsList` from `useQuery` + manual `useState`/`useEffect` accumulation to TanStack Query's native `useInfiniteQuery` (`initialPageParam: 1`, `getNextPageParam` derived from accumulated items vs `total`); removed `page` from `notificationKeys.list` factory type signature (managed by `pageParam` — all pages of the same filter share one cache entry); refactored `NotificationCenter.tsx` to use `data.pages.flatMap(p => p.items)` instead of manual accumulation with `Set`-based dedup; rewrote `useMarkRead`/`useMarkAllRead` optimistic `onMutate` callbacks to handle `{ pages, pageParams }` shape — changed from `'items' in old` to `'pages' in old`, mapping over `old.pages` to update items within each page — fixed a latent bug where optimistic updates silently no-op'd against the infinite query data shape; `useUnreadCount` still uses `useQuery` (returns a number, not paginated data) — its `typeof old === 'number'` check is preserved unchanged; review fix: removed redundant type annotation on `data?.pages.flatMap(...)` in `NotificationCenter.tsx`
- **Detail:** `conductor/archive/notification-center-infinite-query-migration_20260726/` (spec.md, plan.md)

---

## Milestone 10: Infrastructure Consistency & Tech Debt Remediation

> This milestone addresses structural inconsistencies and tech debt identified in a comprehensive infrastructure audit conducted after Milestone 9. The audit examined server-function architecture, type safety, error handling, i18n completeness, test configuration, and developer tooling. Findings are prefixed `INFRA-` to distinguish them from prior audit IDs. Tracks are ordered by ROI: quick wins first, then structural standardization, then the larger type-safety restoration effort.

---

### TRACK-031: Server-Side Guard Consolidation & Env Type Consolidation
- **Status:** ✅ Complete · **Audit IDs:** INFRA-1 (role-check helper duplication), INFRA-7 (redundant Env type reconstruction in `env.ts`) · **Deps:** None
- **Key decisions:** Created `src/lib/session-guards.ts` shared module with 4 client-safe type-guard functions (`isAdmin`, `isInstructor`, `isStudent`, `isAuthenticated` — all accept `NonNullableSession | null`, return `session is NonNullableSession`); replaced 28 duplicate inline guard definitions across 20 `*.server.ts` files with imports from the shared module; refactored `requireRole` in `src/server/auth.ts` to use `isAuthenticated`; consolidated `Env` type in `src/config/env.ts` — replaced manual `z.infer<typeof baseSchema> & Partial<z.infer<typeof r2Schema>> & {...}` with `z.infer<typeof envSchema>`, removed dead `baseSchema` and `r2Schema` constants (their validation messages were never surfaced — `envSchema` redefined R2 fields with plain `.optional()`); `templates.server.ts` retains `NonNullableSession` import for out-of-scope `isInstructorOrAdmin` (array membership, not single-role narrowing); 20 new unit tests in `tests/unit/lib/session-guards.test.ts`; all 3,773 tests pass, typecheck clean, lint clean (4 pre-existing warnings unrelated)
- **Detail:** `conductor/archive/server-guard-env-consolidation_20260727/` (spec.md, plan.md)

---

### TRACK-032: Type-Safety Restoration — Eliminate `as unknown as` Casts

*   **Status:** `Pending`
*   **Dependencies:** None (recommended AFTER TRACK-031 — guard consolidation reduces the surface area of server-function calls to audit)
*   **Estimated Effort:** 5 Days / 2.5 Sprint Loops
*   **Audit IDs:** INFRA-4 (systemic type-safety erosion — ~80 `as unknown as` casts across hooks, components, routes, and server files)

#### Context Anchors (Traceability)
*   **PRD Reference:** N/A (type-safety infrastructure, no product impact)
*   **TDD Reference:** `conductor/archive/instructor-ui-consistency_20260619/spec.md` (Track that first identified the `createServerFn` type-gap — removed `@ts-expect-error` from route loaders but the underlying gap was patched with casts); `src/server/assignments.ts` (canonical typed-builder stub pattern: `createServerFn({ method }).inputValidator(Schema).handler(...)`); `src/server/submissions.ts` (canonical inline-parse pattern); `src/hooks/use-notifications.ts` (representative hook with 4 `as unknown as` casts on server fn calls)

#### Track Tech Stack
*   TypeScript 7 (type inference, generic constraints)
*   `@tanstack/react-start` (`createServerFn` — the wrapper whose return type doesn't propagate to client callers)
*   `@tanstack/react-router` (route loader typing — `Route.useLoaderData()` return types)
*   Drizzle ORM (`as unknown as ScoreRow[]` query-result casts in server handlers)

#### Scope Boundaries
*   **In Scope:**
    *   **Diagnose the `createServerFn` type-gap root cause:** Determine why the return type of `.handler(async ({ data }) => { ... })` doesn't propagate to the client-callable stub. Investigate whether the gap is in the TanStack Start `createServerFn` generic, the `.inputValidator()` chain, or the dynamic `await import('./feature.server')` pattern.
    *   **Fix the type propagation at the source:** Apply the minimal typing change (likely a generic constraint or wrapper utility in a shared `src/lib/server-fn.ts` helper) so that `createServerFn` stubs propagate their handler's return type to callers without casts.
    *   **Remove `as unknown as` casts from hooks:** Eliminate casts in `src/hooks/use-notifications.ts` (4 casts), `src/hooks/use-assignment-tabs.ts` (3 casts), and any other hooks.
    *   **Remove `as unknown as` casts from components:** Eliminate casts in `src/components/settings/TwoFactorSettings.tsx` (4 casts), `src/components/settings/SessionManagement.tsx` (3 casts), `src/components/settings/ProfileSection.tsx` (2 casts), `src/components/settings/NotificationPreferencesSection.tsx` (2 casts), `src/components/settings/AccessibilitySection.tsx` (2 casts), `src/components/reviews/ReviewForm.tsx` (2 casts), `src/components/reviews/DeadlineManager.tsx` (2 casts), `src/components/student/extensions/ExtensionRequestForm.tsx` (1 cast), `src/components/consultations/ConsultationForm.tsx` (1 cast), `src/components/consultations/VerificationDialog.tsx` (3 casts), `src/components/discussions/discussion-panel.tsx` (3 casts), `src/components/admin/templates/TemplateDetailPage.tsx` (3 casts), `src/components/instructor/assignments/AssignmentWizard.tsx` (3 casts), `src/components/instructor/assignments/StudentPicker.tsx` (1 cast), `src/components/instructor/assignments/TemplatePicker.tsx` (1 cast), and any others found via grep.
    *   **Remove `as unknown as` casts from routes:** Eliminate loader-data casts and server-fn call casts in: `src/routes/_authenticated/student/dashboard.tsx` (1 cast), `src/routes/_authenticated/admin/dashboard.tsx` (1 cast), `src/routes/_authenticated/admin/analytics.tsx` (2 casts), `src/routes/_authenticated/instructor/analytics.tsx` (2 casts), `src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx` (7 casts), `src/routes/_authenticated/student/assignments/$id.tsx` (6 casts). Redirect casts in `_authenticated.tsx` and `_unauthenticated.tsx` are Out of Scope (TanStack Router typed-routes limitation).
    *   **Remove `as unknown as` casts from server files:** Eliminate Drizzle query-result casts (`as unknown as ScoreRow[]`) in `src/server/analytics-export.server.ts`, `src/server/gradebook.server.ts`, `src/server/reviews-extras.server.ts`, `src/lib/email-queue-retention.ts`, `src/lib/email-queue-processor.ts`.
    *   **Remove `as unknown as` casts from 2FA and auth handlers:** Eliminate `result as unknown as { totpURI?: string; backupCodes?: string[] }` in `src/server/two-factor.server.ts` (Better Auth API response — type properly). Eliminate `result as unknown as NonNullable<Session>` in `src/server/auth.server.ts:56` (Better Auth `getSession` response — type properly).
*   **Out of Scope:**
    *   `src/routeTree.gen.ts` — generated file (`as any` is TanStack Router codegen, not fixable by hand)
    *   Sidebar `to={link.to as unknown as '.'}` casts (`admin-sidebar.tsx`, `instructor-sidebar.tsx`, `student-sidebar.tsx` — 6 casts total) — TanStack Router typed-routes limitation (route paths are string literals; dynamic sidebar configs can't satisfy the literal type). Document as a known limitation, do not attempt to fix.
    *   Auth redirect casts in `src/server/auth.ts` (`redirect({ to: '/auth/login' as unknown as '.' })` — 2 casts) — same TanStack Router typed-routes limitation. Document, do not fix.
    *   Route redirect casts in `src/routes/_authenticated.tsx:30` and `src/routes/_unauthenticated.tsx:9` (2 casts) — same TanStack Router typed-routes limitation. Document, do not fix.
    *   Any changes to server handler logic (type-only changes, no behavioral changes)

#### High-Level Execution Vectors
*   **Phase 1 (Root-cause diagnosis):** Read `src/server/assignments.ts` (typed-builder pattern) and `src/server/submissions.ts` (inline-parse pattern). Write a minimal type-level test (`tests/unit/types/server-fn-types.test-d.ts`) demonstrating that a `createServerFn` stub's return type is `unknown` or `Promise<unknown>` at the call site. Identify the exact point in the chain where type inference breaks. Document the root cause. Verify: type-level test fails (confirming the gap exists).
*   **Phase 2 (Type fix at source):** Apply the minimal typing change to restore type propagation. This may be: (a) a generic constraint on the `createServerFn` wrapper, (b) a shared helper utility in `src/lib/server-fn.ts` that wraps `createServerFn` with proper return-type inference, or (c) explicit return-type annotations on all stub handlers. Verify: type-level test passes, `pnpm typecheck` clean.
*   **Phase 3 (Cast elimination):** Systematically remove `as unknown as` casts from hooks → components → routes → server files. After each file group, run `pnpm typecheck` to catch any inference gaps. For Drizzle query-result casts, use proper `.then()` typing or `z.infer` schema types instead of ad-hoc casts. For Better Auth API responses, use the documented response types from `better-auth`. Verify: `pnpm typecheck` clean after all casts removed, `pnpm test:unit` passes, grep `as unknown as` in `src/` returns only the documented TanStack Router limitations (sidebar, auth redirects).

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Run `pnpm dev` — all pages render without console errors. Navigate to `/settings` — profile, 2FA, sessions, notifications, accessibility sections all load and function. Open `/student/assignments/$id` — checkpoint view, file upload, consultation form all work. Open `/instructor/assignments/$id` — tabs, review form, deadline manager all work. Open `/admin/analytics` — gradebook and analytics export work. Run `pnpm typecheck` — 0 errors. Grep `as unknown as` in `src/hooks/`, `src/components/`, `src/routes/` — zero matches (excluding generated `routeTree.gen.ts` and documented TanStack Router sidebar/auth-redirect limitations).
*   [ ] **Automated Tests:** `pnpm test:unit` — all existing tests pass unchanged (type-only changes, no behavioral changes). New type-level test (`server-fn-types.test-d.ts`) passes, confirming return-type propagation. `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors.
*   [ ] **Conductor Review:** Type-level test exists and passes. Grep `as unknown as` in `src/` returns: zero matches in `src/hooks/`, `src/components/`, `src/lib/`; only documented TanStack Router limitations remain — sidebar casts in `src/components/layout/*-sidebar.tsx`, auth-redirect casts in `src/server/auth.ts`, and route-redirect casts in `src/routes/_authenticated.tsx` and `src/routes/_unauthenticated.tsx`. No `@ts-expect-error` directives added. No `as any` added. All type changes are inference-based (no manual type assertions unless documented with a reason). All files under 500 lines. Pre-push gate passes.

---

### TRACK-033: Server-Function Architecture Standardization

*   **Status:** `Pending`
*   **Dependencies:** None (coordinate with TRACK-032 if both are active — TRACK-032 touches the same stub files for type fixes)
*   **Estimated Effort:** 3 Days / 1.5 Sprint Loops
*   **Audit IDs:** INFRA-2 (inconsistent server-function split patterns), INFRA-3 (17 circular dependency chains), INFRA-5 (setup-password.ts error handling inconsistency), INFRA-9 (audit-log naming inconsistency)

#### Context Anchors (Traceability)
*   **PRD Reference:** N/A (architecture standardization, no product impact)
*   **TDD Reference:** `AGENTS.md` → "Server function split" (documents two calling patterns but not the structural file layout); `conductor/workflow.md` → "Quality Gates" (enforces two-file split: `*.ts` + `*.server.ts`); `src/server/assignments.ts` + `assignments.server.ts` + `assignments-extras.server.ts` (canonical extras pattern); `src/server/dashboard.ts` + `dashboard-*.server.ts` (canonical multi-handler pattern); `src/server/setup-password.ts` (violates two-file split — schemas + handler + stub in one file); `src/lib/errors.ts` (canonical `serverError()` + `ErrorCode` pattern that setup-password.ts doesn't use)

#### Track Tech Stack
*   TypeScript (architecture refactor — no new dependencies)
*   `src/server/*.ts` and `src/server/*.server.ts` (all server function files)
*   `src/db/schema/audit-log.ts` → `src/server/audit-logs.ts` (naming inconsistency)
*   `src/server/setup-password.ts` (refactor to two-file split)
*   `AGENTS.md` (documentation update for split-pattern rules)

#### Scope Boundaries
*   **In Scope:**
    *   **Document the server-function split taxonomy:** Update `AGENTS.md` with explicit rules for when to use each structural pattern: (1) Standard pair (default — `*.ts` + `*.server.ts`), (2) Extras variant (`*-extras.server.ts` — when a feature has both student-facing and instructor-facing handlers that would exceed the 500-line limit), (3) Multi-handler (multiple `*.server.ts` files — when a feature serves multiple roles with distinct query logic, e.g., role-specific dashboards), (4) Handler-only (no `*.ts` stub — internal helper, never called from client).
    *   **Refactor `setup-password.ts` to two-file split:** Split into `src/server/setup-password.ts` (Zod schema + `createServerFn` stub with dynamic import) and `src/server/setup-password.server.ts` (handler implementation). Migrate error handling from `{ error: string }` to `serverError(ErrorCode.X, message)` + `ServerError` type. Add `logError` calls.
    *   **Address circular dependencies:** Audit the 17 circular dependency chains. For type-only `import type { Schema } from './feature'` cycles, verify they are erased at compile time (no runtime impact) and document them as acceptable. For any runtime value imports creating cycles, refactor to break the cycle (e.g., move shared schema to a third file, or pass types via a shared `types.ts`).
    *   **Fix audit-log naming:** Rename `src/server/audit-logs.ts` → `src/server/audit-log.ts` and `src/server/audit-logs.server.ts` → `src/server/audit-log.server.ts` to match the schema file (`src/db/schema/audit-log.ts`) and DB table (`audit_log`). Update all import paths.
*   **Out of Scope:**
    *   Consolidating `*-extras.server.ts` files into main `.server.ts` files (the extras pattern is valid for file-size management — just needs documentation)
    *   Merging multi-handler `.server.ts` files (the pattern is valid for role-separated logic — just needs documentation)
    *   Changes to handler logic or API contracts (purely structural/naming)
    *   Database schema changes (table name stays `audit_log`)

#### High-Level Execution Vectors
*   **Phase 1 (Documentation):** Update `AGENTS.md` "Server function split" section with the 4-pattern taxonomy and decision criteria. Document the type-only circular dependency pattern as acceptable (with rationale). Verify: documentation is clear and matches existing code patterns.
*   **Phase 2 (setup-password refactor):** Split `setup-password.ts` into stub + handler. Migrate error returns to `serverError()`. Update tests to mock the new two-file pattern. Verify: `pnpm typecheck` clean, `pnpm test:unit` passes, password setup flow works end-to-end.
*   **Phase 3 (Naming + circular-deps audit):** Rename audit-log server files. Update all import paths. Run `pnpm codebase_graph_circular` (or equivalent) to verify circular chains are type-only (no runtime value imports). Verify: `pnpm typecheck` clean, `pnpm test:unit` passes, `pnpm lint` clean, import paths updated.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Run `pnpm dev` — navigate to password setup page (`/auth/setup-password?token=...`) — flow works, errors display correctly. Admin views audit logs — page loads. Run `pnpm typecheck` — 0 errors. Run code graph circular dependency check — all remaining cycles are `import type` only (no runtime value imports).
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. Updated tests for `setup-password` (mock two-file pattern, verify `serverError` return type). `pnpm test:coverage` ≥80%. `pnpm typecheck` clean. `pnpm lint` — 0 warnings, 0 errors.
*   [ ] **Conductor Review:** `AGENTS.md` documents 4 split patterns with decision criteria. `src/server/setup-password.ts` contains only Zod schema + `createServerFn` stub. `src/server/setup-password.server.ts` contains handler using `serverError()`. `src/server/audit-log.ts` and `src/server/audit-log.server.ts` match schema file naming. All circular dependency chains verified as type-only. All files under 500 lines. Pre-push gate passes.

---

### TRACK-034: i18n & Email Localization Completeness
- **Status:** ✅ Complete · **Audit IDs:** INFRA-6 (hardcoded 2FA email subjects) · **Deps:** None
- **Key decisions:** Replaced 2 hardcoded 2FA email subjects in `src/server/two-factor.server.ts` with `resolveEmailSubject('emails.subjects.twoFactorEnabled'|'twoFactorDisabled', undefined, session.user.locale as Locales)` calls; added `emails.subjects.twoFactorEnabled` / `twoFactorDisabled` i18n keys to both locale files; regenerated `src/i18n/types.ts` via `pnpm generate:i18n`; updated `tests/unit/server/two-factor.test.ts` to mock `@/lib/i18n-server` and assert `resolveEmailSubject` called with correct key + `session.user.locale`; Phase 2 audit confirmed zero hardcoded `subject:` string literals remain in `src/server/` or `src/lib/`; email body localization explicitly deferred (HTML bodies remain English-only by design)
- **Detail:** `conductor/archive/i18n-email-localization_20260727/` (spec.md, plan.md)

---

### TRACK-035: Test Infrastructure Consolidation

*   **Status:** `Pending`
*   **Dependencies:** None
*   **Estimated Effort:** 1 Day / 0.5 Sprint Loops
*   **Audit IDs:** INFRA-8 (fragile test script configuration)

#### Context Anchors (Traceability)
*   **PRD Reference:** N/A (test infrastructure, no product impact)
*   **TDD Reference:** `vitest.config.ts` (current config — `pool: 'vmThreads'`, `include: ['tests/**/*.test.{ts,tsx}']`, `exclude: ['node_modules', 'dist']` — does NOT exclude integration tests); `package.json` (test scripts with complex `--exclude` flags and dual-run pattern); `AGENTS.md` → "Developer Commands" (documents `pnpm test` excludes `tests/integration/**`)

#### Track Tech Stack
*   `vitest.config.ts` (test runner config)
*   `vitest.config.integration.ts` (new — integration test config that extends base but removes integration from `exclude`)
*   `package.json` (script cleanup)
*   `tests/unit/lib/parse-templates-xlsx.test.ts`, `parse-users-xlsx.test.ts`, `sample-generators.test.ts`, `excel-export.test.ts` (4 files incompatible with `vmThreads` pool)

#### Scope Boundaries
*   **In Scope:**
    *   **Move integration test exclusion into `vitest.config.ts`:** Add `'tests/integration/**'` to the `exclude` array in `vitest.config.ts` so bare `vitest` matches `pnpm test` behavior. Remove the `--exclude tests/integration/**` from `pnpm test`, `pnpm test:unit`, and `pnpm test:watch` scripts.
    *   **Create `vitest.config.integration.ts`:** Since adding `'tests/integration/**'` to the config `exclude` array would break `pnpm test:integration` (Vitest applies config `exclude` even when filtering by path), create a minimal `vitest.config.integration.ts` that extends the base config but removes integration from `exclude`. Update `test:integration` script to `vitest run --config vitest.config.integration.ts tests/integration`.
    *   **Address `vmThreads` incompatibility at config level:** The 4 xlsx/Excel test files fail under `vmThreads` pool and are currently run separately with `--pool=threads`. Investigate using Vitest's per-file or per-directory environment override (e.g., `test.environmentMatchGlobs` or a separate `vitest.config.excel.ts` project) instead of the dual-run script pattern. If a clean config-level solution isn't feasible, document why and keep the dual-run but extract the file list into a shared variable.
    *   **Fix `test:watch` xlsx gap:** Currently `test:watch` excludes the 4 xlsx files but has no second `--pool=threads` run for them — xlsx tests are silently skipped in watch mode. The config-level xlsx pool fix (above) resolves this automatically.
    *   **Fix `test:coverage` pool override:** Currently `test:coverage` uses `--pool=threads` for ALL tests (50% slower than `vmThreads`), not just the 4 xlsx files. After the config-level xlsx fix, remove `--pool=threads` from `test:coverage` so it uses the default `vmThreads` pool.
    *   **Remove duplicate `test:unit` script:** `pnpm test:unit` is identical to `pnpm test`. Either remove `test:unit` and update `AGENTS.md` references, or make `test:unit` a thin alias (`"test:unit": "pnpm test"`).
    *   **Simplify `test:coverage` script:** Ensure `test:coverage` also excludes integration tests via config, not command-line flag.
*   **Out of Scope:**
    *   Changing the default test pool from `vmThreads` to `threads` (vmThreads is 50% faster — the 4 files should be fixed, not the default changed)
    *   Adding new tests or changing test coverage thresholds
    *   Integration test improvements (only config/exclusion changes)
    *   E2E test changes (Playwright config is separate)

#### High-Level Execution Vectors
*   **Phase 1 (Config consolidation):** Add `'tests/integration/**'` to `vitest.config.ts` `exclude` array. Create `vitest.config.integration.ts` that extends the base config but overrides `exclude` to NOT exclude integration tests. Update `test:integration` script to use `--config vitest.config.integration.ts`. Remove `--exclude tests/integration/**` from all package.json test scripts. Verify: bare `vitest run` excludes integration tests (matches `pnpm test`), `pnpm test` still passes, `pnpm test:integration` still runs integration tests.
*   **Phase 2 (xlsx pool fix + coverage):** Investigate Vitest 4's `projects` or `environmentMatchGlobs` config to assign `threads` pool to the 4 xlsx test files at config level. If feasible, remove the dual-run pattern from package.json and remove `--pool=threads` from `test:coverage` (let it use default `vmThreads`). If not feasible, document the limitation and extract the file list to a shared constant. Verify: `pnpm test` passes (both pools or config-level override), `pnpm test:coverage` passes with `vmThreads` default pool, `pnpm test:watch` runs xlsx tests.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Run bare `vitest run` (not via `pnpm test`) — integration tests are excluded. Run `pnpm test` — all unit tests pass (including xlsx tests). Run `pnpm test:coverage` — coverage passes with ≥80% thresholds, integration tests excluded, uses `vmThreads` pool. Run `pnpm test:watch` — watch mode excludes integration tests AND runs xlsx tests. Run `pnpm test:integration` — integration tests run via `vitest.config.integration.ts`. Review `package.json` — `test` and `test:unit` are either identical aliases or `test:unit` is removed.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. `pnpm test:coverage` ≥80% on all thresholds. `pnpm typecheck` clean. `pnpm lint` clean.
*   [ ] **Conductor Review:** `vitest.config.ts` `exclude` array contains `'tests/integration/**'`. `vitest.config.integration.ts` exists and overrides `exclude` for integration tests. `package.json` test scripts no longer have `--exclude tests/integration/**` flags. `test:coverage` no longer uses `--pool=threads` for all tests. The dual-run xlsx pattern is either resolved at config level or documented with rationale. `test:unit` is either an alias or removed (no duplicated long script). `AGENTS.md` "Developer Commands" table matches the actual scripts. All files under 500 lines. Pre-push gate passes.

---

### TRACK-036: Developer Experience & Tooling Hygiene

*   **Status:** `Pending`
*   **Dependencies:** None
*   **Estimated Effort:** 1 Day / 0.5 Sprint Loops
*   **Audit IDs:** INFRA-10 (lefthook vs package.json configuration mismatch)

#### Context Anchors (Traceability)
*   **PRD Reference:** N/A (developer tooling, no product impact)
*   **TDD Reference:** `lefthook.yml` (pre-commit `lint` glob: `src/**/*.{js,jsx,ts,tsx}` — src only; pre-commit `format` glob: `*.{js,jsx,ts,tsx}` — all dirs, no `.css`; pre-push `typecheck`: `tsc --noEmit --incremental --checkers 4`); `package.json` (`lint` script: `oxlint .` — everything; `format` script: `oxfmt --write "src/**/*.{ts,tsx,css}"` — src only, includes `.css`; `typecheck` script: `tsc --noEmit --incremental` — no `--checkers`); `AGENTS.md` → "Formatting Quirks" (documents oxfmt on `src/**/*.{ts,tsx,css}`)

#### Track Tech Stack
*   `lefthook.yml` (git hook config)
*   `package.json` (script alignment)
*   `.socraticodecontextartifacts.json` (new file — SocratiCode context artifact config)

#### Scope Boundaries
*   **In Scope:**
    *   **Align lefthook format glob with package.json:** The pre-commit `format` hook formats files in `tests/` and `scripts/` (glob: `*.{js,jsx,ts,tsx}`), but `pnpm format` only targets `src/**/*.{ts,tsx,css}`. Two gaps: (1) lefthook glob doesn't include `.css` files — add `.css` to the lefthook format glob so pre-commit formats CSS files too; (2) scope mismatch (all dirs vs src only) — either expand `pnpm format` to include `tests/` and `scripts/` (recommended — ensures manual format matches pre-commit), or narrow the lefthook glob to match `pnpm format` scope. Document the decision in `AGENTS.md`.
    *   **Align lefthook lint glob with pnpm lint:** The pre-commit `lint` hook only lints `src/` files (glob: `src/**/*.{js,jsx,ts,tsx}`), but `pnpm lint` runs `oxlint .` (everything). Expand the lefthook lint glob to `*.{js,jsx,ts,tsx}` (all dirs) to match the format and modularity globs, so lint errors in `tests/` and `scripts/` are caught at commit time.
    *   **Align lefthook typecheck with package.json:** The pre-push `typecheck` uses `--checkers 4` but `pnpm typecheck` doesn't. Add `--checkers 4` to `pnpm typecheck` in `package.json` (or remove from lefthook — but the TS 7 track explicitly added it for parallelism, so adding to `pnpm typecheck` is preferred).
    *   **Configure SocratiCode context artifacts:** Create `.socraticodecontextartifacts.json` with entries for: `conductor/product.md`, `conductor/tech-stack.md`, `conductor/workflow.md`, `conductor/product-guidelines.md`, `drizzle/migrations/` (DB schema history), `docs/PRD.md`, `docs/TDD.md`. Run `codebase_context_index` to index them.
*   **Out of Scope:**
    *   Changes to test coverage thresholds (handled in TRACK-035)
    *   Structured logging migration (deferred — `console.error(JSON.stringify(...))` is functional; a pino/winston migration is a separate infrastructure track)
    *   Pagination UI component consolidation (deferred — identified in the instructor-ui-consistency audit as a "should-have" but requires UI design work, not tooling)
    *   Any code changes beyond config files

#### High-Level Execution Vectors
*   **Phase 1 (Lefthook alignment):** Update `package.json` `format` script to include `tests/` and `scripts/` (or narrow lefthook glob — decide based on whether test/script formatting is desired). Add `.css` to lefthook format glob. Expand lefthook lint glob from `src/**/*.{js,jsx,ts,tsx}` to `*.{js,jsx,ts,tsx}` (all dirs). Add `--checkers 4` to `pnpm typecheck`. Update `AGENTS.md` "Formatting Quirks" and "Developer Commands" to match. Verify: `pnpm format`, `pnpm lint`, and `pnpm typecheck` match lefthook behavior.
*   **Phase 2 (SocratiCode artifacts):** Create `.socraticodecontextartifacts.json`. Run `codebase_context_index`. Verify `codebase_context_search` returns results from conductor docs and PRD/TDD.

#### Verification & Definition of Done (DoD)
*   [ ] **Manual Checkpoint:** Run `pnpm format` — formats files in `src/`, `tests/`, and `scripts/` (if expanded), including `.css` files. Run `pnpm typecheck` — uses `--checkers 4` (TS 7 parallelism). Run `pnpm lint` — lints all directories (matches lefthook lint glob). Verify `.socraticodecontextartifacts.json` exists and `codebase_context_search` returns results from conductor docs and PRD/TDD.
*   [ ] **Automated Tests:** `pnpm test:unit` — all tests pass. `pnpm typecheck` clean. `pnpm lint` clean. `pnpm check:i18n` parity maintained.
*   [ ] **Conductor Review:** `lefthook.yml` format glob matches `pnpm format` scope (including `.css`). `lefthook.yml` lint glob matches `pnpm lint` scope (all dirs). `package.json` `typecheck` script uses `--checkers 4`. `.socraticodecontextartifacts.json` exists with documented artifacts. `codebase_context_search` returns results from indexed artifacts. `AGENTS.md` reflects the updated scripts. All files under 500 lines. Pre-push gate passes.

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
├── TRACK-020: Rubric-Based Grading & Evaluation [Complete — archived]
├── TRACK-021: Proactive Deadline Reminder System [no deps — recommended after 022]
├── TRACK-022: User Notification Preferences [Complete — archived]
├── TRACK-023: At-Risk Student Identification [Complete — archived]
├── TRACK-025: Gradebook & Final Grade Computation [depends on 020 — aggregates review_scores]
└── TRACK-026: Checkpoint Discussion / Q&A Threads [Complete — archived]

Milestone 7: Infrastructure & Tooling
└── TRACK-024: TypeScript 7 Upgrade [Complete — archived]

Milestone 8: E2E Coverage Expansion
├── TRACK-027: Critical Business Flow E2E Coverage [Complete — archived]
└── TRACK-028: E2E Breadth & Infrastructure Expansion [Complete — archived]

Milestone 9: Client Architecture Consistency
├── TRACK-029: Query-Key Factory Completion & Client Data-Fetching Consistency [Complete — extends query-key factory]
└── TRACK-030: NotificationCenter Infinite Query Migration [Complete — depends on 014 — notificationKeys factory]

Milestone 10: Infrastructure Consistency & Tech Debt Remediation
├── TRACK-031: Server-Side Guard Consolidation & Env Type Consolidation [Complete — archived]
├── TRACK-032: Type-Safety Restoration — Eliminate `as unknown as` Casts [recommended after 031]
├── TRACK-033: Server-Function Architecture Standardization [coordinate with 032]
├── TRACK-034: i18n & Email Localization Completeness [Complete — archived]
├── TRACK-035: Test Infrastructure Consolidation [no deps]
└── TRACK-036: Developer Experience & Tooling Hygiene [no deps]
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
| **G** | TRACK-014, TRACK-016, TRACK-017, TRACK-018, TRACK-019 | Fully independent — no file overlap (distinct domains: mutations, email ops, review UX, notifications, analytics) — TRACK-014/015/016/017/018 complete |
| **H** | TRACK-015 → TRACK-014 | Sequential — TRACK-015 consumed the query-key factory from TRACK-014 for useQuery conversion (both complete — TRACK-014 archived, TRACK-015 archived) |
| **I** | TRACK-020 | Independent — new domain (rubrics/grading), extends completed tracks (template editor, review screen, analytics) but no concurrent work |
| **J** | TRACK-021 | Independent — extends existing email-queue polling loop + notifications, no file overlap with TRACK-020 (different domain: deadline reminders vs grading) |
| **K** | TRACK-022 | Complete — extends existing `users.settings` JSONB + `enqueueEventEmail` chokepoint + 12 notification sites with per-type per-channel preference gating. Implemented alongside TRACK-021 so `deadline_reminder` type respects user prefs from day one (complete — archived) |
| **L** | TRACK-023 | Independent — new risk-scoring module + dashboard widget + event-driven alerts at `submitReviewHandler`. No file overlap with TRACK-020/021/022 (different domain: risk identification vs grading/reminders/preferences). Complementary to TRACK-021 (event-driven catches discrete risk moments, scanner catches time-based risk). Minor overlap with TRACK-022 on notification type registry — coordinate if parallelized (complete — archived) |
| **M** | TRACK-024 | Fully independent — only touches `tsconfig.json` and `package.json`, no feature file overlap (complete — archived) |
| **N** | TRACK-025 | Depends on TRACK-020 (complete) — extends `review_scores` data and analytics export infrastructure. No file overlap with TRACK-023 (different domain: grade computation vs risk scoring). Minor overlap with analytics dashboards — coordinate if parallelized with TRACK-023 admin analytics extension |
| **O** | TRACK-026 | Complete — new domain (discussions), extended notification infrastructure (TRACK-022) and email queue (TRACK-018). No file overlap with TRACK-025 (different domain: discussions vs grading). Archived |
| **P** | TRACK-027 → TRACK-028 | Both complete (archived). TRACK-027 expanded seed data (student2, student3, consultation seed) + decoupled instructor-review tests + 3 new specs + notification/upload/negative test assertions. TRACK-028 built on this expanded seed data and decoupled patterns — expanded coverage to 73 tests across 14 spec files, added Firefox + mobile-chrome projects, axe-core a11y scanning, cross-role lifecycle test. No file overlap with feature tracks (TRACK-025/026) — only touches `tests/e2e/`, `scripts/seed-e2e.ts`, and `playwright.config.ts` |
| **Q** | TRACK-029, TRACK-030 | Both complete — TRACK-029 touched `query-keys.ts` + settings + gradebook components (archived); TRACK-030 touched `use-notifications.ts` + `NotificationCenter.tsx` + `query-keys.ts` (archived). Both depended on TRACK-014 (complete — query-key factory). No file overlap with E2E tracks (TRACK-027/028 — different domain: client data-fetching vs e2e tests). Minor overlap with gradebook feature (TRACK-025 — complete) on gradebook component files (TRACK-029 only) |
| **R** | TRACK-031, TRACK-034 (complete — archived), TRACK-035, TRACK-036 | Fully independent quick wins — TRACK-031 touches `src/server/*.server.ts` (guard imports) + `src/config/env.ts`; TRACK-034 touched `src/server/two-factor.server.ts` + locale files (complete — archived); TRACK-035 touches `vitest.config.ts` + `package.json`; TRACK-036 touches `lefthook.yml` + `package.json` + `.socraticodecontextartifacts.json`. Minor overlap: TRACK-035 and TRACK-036 both touch `package.json` scripts — coordinate to avoid merge conflicts |
| **S** | TRACK-032 → TRACK-033 | Sequential — TRACK-032 (type-safety restoration) touches the same `createServerFn` stub files that TRACK-033 (architecture standardization) refactors. Complete TRACK-032's type fixes first, then TRACK-033's structural changes. Both touch `src/server/*.ts` and `src/server/*.server.ts` |

---

## Effort Summary

| Milestone | Tracks | Estimated Effort |
|-----------|:---:|:---:|
| 1: Critical Fixes | 4 | ~12 Days |
| 2: Performance & Optimization | 3 | ~7 Days |
| 3: UX & Accessibility | 6 | ~13 Days |
| 4: Quality Assurance | 1 | ~3 Days |
| 5: Post-Audit Enhancements | 6 | ~25 Days |
| 6: New Features | 6 | ~34 Days |
| 7: Infrastructure & Tooling | 1 | ~1 Day |
| 8: E2E Coverage Expansion | 2 | ~9 Days |
| 9: Client Architecture Consistency | 2 | ~3 Days |
| 10: Infrastructure Consistency & Tech Debt | 6 | ~12 Days |
| **Total** | **37** | **~119 Days** |

> Effort estimates assume a single developer. Tracks within the same parallelization group can be distributed across developers to reduce wall-clock time.

---

## Adding New Tracks

New tracks follow a two-phase lifecycle in this document:

1. **Planned/Active** — Add a full-detail entry under the appropriate milestone (status, audit IDs, deps, decisions, scope, execution vectors, DoD). Scaffold via `conductor_new_track` which creates `conductor/tracks/<track_id>/spec.md` + `plan.md`.
2. **Complete** — On archival to `conductor/archive/<track_id>_<date>/`, collapse the entry to an index row: status badge, audit IDs, deps, one-line decision summary, archive link. The archive's `spec.md` and `plan.md` become the single source of truth for full detail.

This keeps the roadmap scannable — new tracks add ~5 lines as index entries, not ~50–100 lines of duplicated detail.
