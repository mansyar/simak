<protect>
# Implementation Plan: At-Risk Student Identification & Early Warning System

## Phase 1: Risk Scoring Engine

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
- [x] Task: Define risk scoring types and interfaces [9555d04]
    - [x] Create `src/lib/risk-scoring.ts` with type definitions: `RiskLevel`, `RiskCategory`, `RiskFactor`, `StudentRiskInput`, `RiskAssessment`
    - [x] Export the `computeStudentRisk` function signature (stub returning `{ level: 'low', factors: [] }`)
    - [x] Run `pnpm typecheck` — verify types compile

- [x] Task: Write unit tests for `computeStudentRisk` (Red) [14e175c]
    - [x] Create `tests/unit/lib/risk-scoring.test.ts`
    - [x] Test signal 1 (overdue checkpoint → High, student_inaction)
    - [x] Test signal 2 (approaching deadline, no submission → Medium, student_inaction)
    - [x] Test signal 3 (insufficient consultations → Medium, student_inaction)
    - [x] Test signal 4 (repeated revise ≥ 2 → Medium, student_inaction)
    - [x] Test signal 5 (SLA stall > 3 days → Low, pending_review)
    - [x] Test multi-factor aggregation (2+ active signals → highest severity, all factors listed)
    - [x] Test no-risk student (all checkpoints passed → level: 'low', empty factors[])
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement `computeStudentRisk` function (Green) [606e555]
    - [x] Implement all 5 signal checks with thresholds
    - [x] Implement severity escalation (overall level = highest active signal)
    - [x] Implement category labeling (signals 1-4 = student_inaction, signal 5 = pending_review)
    - [x] Run `pnpm test` — confirm all tests pass
    - [x] Run `pnpm test:coverage` — verify ≥80% on risk-scoring.ts

- [x] Task: Conductor - User Manual Verification 'Phase 1: Risk Scoring Engine' (Protocol in workflow.md) [checkpoint: b702277]

## Phase 2: Dashboard Integration + Event-Driven Alerts + Scanner Integration

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
- [x] Task: Write tests for instructor dashboard handler extension (Red) [1eaa022]
    - [x] Extend `tests/unit/server/dashboard-instructor.test.ts` (or mirror path)
    - [x] Test at-risk list populated correctly from batch query
    - [x] Test sorted by severity (high → medium → low)
    - [x] Test `passed`/`locked` checkpoints excluded
    - [x] Test empty when no risk
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement instructor dashboard handler extension (Green) [1eaa022]
    - [x] Extend `getInstructorDashboardDataHandler` with batch join query (checkpoints + assignments + assignment_students + users + consultations + submissions + reviews)
    - [x] Filter to states `('unlocked','revise','under_review','submitted')`
    - [x] Pass per-student data to `computeStudentRisk`
    - [x] Add `atRiskStudents` to response (level ≥ low, sorted high→medium→low)
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Write tests for `risk-alerts.ts` (Red) [6e0de47]
    - [x] Create `tests/unit/lib/risk-alerts.test.ts`
    - [x] Test fires when risk ≥ medium
    - [x] Test skips when risk = low
    - [x] Test dedup skips when notification exists within 7 days
    - [x] Test advisory try/catch doesn't throw
    - [x] Test `Promise.allSettled` for parallel notification + email
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement `risk-alerts.ts` (Green) [7619028]
    - [x] Create `src/lib/risk-alerts.ts` with `checkAndFireRiskAlert(db, opts)`
    - [x] Fetch student checkpoint data for the assignment
    - [x] Call `computeStudentRisk`
    - [x] Check 7-day dedup via `notifications` table query
    - [x] Fire in-app notification + email via `Promise.allSettled` (matching `review-sla.ts` pattern)
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Write tests for `submitReviewHandler` integration (Red) [57d3da9]
    - [x] Extend `tests/unit/server/reviews-advisory-isolation.test.ts`
    - [x] Test revise decision triggers `checkAndFireRiskAlert` (if medium/high)
    - [x] Test pass review does NOT trigger alert
    - [x] Test SLA breach triggers alert
    - [x] Test advisory try/catch doesn't affect review transaction
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement `submitReviewHandler` integration (Green) [57d3da9]
    - [x] Extend `submitReviewHandler` (`reviews.server.ts:220`) — post-commit, when `decision === 'revise'` OR SLA breach, call `checkAndFireRiskAlert` (advisory, outside transaction)
    - [x] Extracted to `src/lib/review-risk-alert.ts` helper to stay within 500-line file limit
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Write tests for TRACK-021 scanner integration (Red)
    - [x] Extend `tests/unit/lib/deadline-reminder-scanner.test.ts` (or mirror path)
    - [x] Test scanner calls `checkAndFireRiskAlert` for students with approaching deadlines
    - [x] Test signals 2 & 3 coverage (approaching deadline + insufficient consultations)
    - [x] Test 7-day dedup prevents alert fatigue
    - [x] Test scanner failure isolation (risk alert errors don't affect reminder processing)
    - [x] Run `pnpm test` — confirm tests fail as expected
    - Commit: `0aacc54b`

- [x] Task: Implement TRACK-021 scanner integration (Green)
    - [x] Extend `processDeadlineReminders()` in `src/lib/deadline-reminder-scanner.ts` — for each student-checkpoint processed, call `checkAndFireRiskAlert` (advisory, try/catch)
    - [x] Run `pnpm test` — confirm tests pass
    - Commit: `0aacc54b`

- [x] Task: Write tests for admin analytics extension (Red) [242797c]
    - [x] Created `tests/unit/server/analytics-at-risk.test.ts` (separate file to stay within 500-line limit)
    - [x] Updated `emptyResults` in `analytics-admin.test.ts` to include 9th entry for at-risk query
    - [x] Added `atRiskSummary` property check to "all expected fields" test
    - [x] Test atRiskSummary with high/medium/low counts
    - [x] Test zero counts when no at-risk students
    - [x] Test defaults to zeros when query returns empty
    - [x] Test atRiskSummary values are numbers

- [x] Task: Implement admin analytics extension (Green) [242797c]
    - [x] Extend `getAdminAnalyticsDataHandler` (`analytics-admin.server.ts`) with `atRiskSummary` (simplified SQL counting distinct students per signal)
    - [x] Added `inArray` import, `atRiskSummary` to `AdminAnalyticsData` type
    - [x] Single query with CASE WHEN expressions counting DISTINCT students per risk level
    - [x] Null-safe defaults (`atRiskRow?.high ?? 0`)
    - [x] Run `pnpm test` — confirm all 3424 tests pass across 329 files

- [x] Task: Conductor - User Manual Verification 'Phase 2: Dashboard + Alerts + Scanner' (Protocol in workflow.md) [checkpoint: 15d1744]

## Phase 3: UI, Email & i18n [checkpoint: 56ad74f2]

- [x] Task: Read `spec.md` and `conductor/workflow.md` to review requirements and TDD protocol for this phase
- [x] Task: Write tests for email template (Red) [commit: 0dda8b4]
    - [x] Create/extend `tests/unit/lib/email-templates.test.ts`
    - [x] Test `buildStudentAtRiskHtml` renders in both EN and ID locales
    - [x] Test `STRINGS` object content for `studentAtRisk`
    - [x] Test factor descriptions rendered
    - [x] Test CTA link to `${BETTER_AUTH_URL}/instructor/assignments/${assignmentId}`
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement email template + wrapper (Green) [commit: 0dda8b4]
    - [x] Add `buildStudentAtRiskHtml` to `email-templates.ts` (internal helpers + `STRINGS[locale].studentAtRisk`)
    - [x] Create `src/lib/at-risk-email.ts` (`sendStudentAtRiskEmail` calling `enqueueEventEmail`)
    - [x] Add `'student_at_risk'` to `templateType` array in `email-queue.ts` (code-only)
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Write tests for notification routes + GROUP_CONFIGS (Red) [commit: 511581f]
    - [x] Extend `tests/unit/lib/notification-routes.test.ts` (or mirror path)
    - [x] Test `student_at_risk` route derives `/instructor/assignments/${meta.assignmentId}`
    - [x] Test `student_at_risk` added to `system` group in `GROUP_CONFIGS`
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement notification routes + GROUP_CONFIGS (Green) [commit: 511581f]
    - [x] Extend `notification-routes.ts` `getNotificationRoute()` with `case 'student_at_risk':` returning `/instructor/assignments/${meta.assignmentId}`
    - [x] Add `student_at_risk` to `system` group in `GROUP_CONFIGS` (`NotificationCenter.tsx`)
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Write tests for dashboard widget (Red) [commit: af2753e]
    - [x] Create `tests/unit/routes/_authenticated/instructor/dashboard.test.tsx` (or mirror path)
    - [x] Test widget renders risk levels with correct Badge colors (yellow/orange/red)
    - [x] Test student name, assignment title, factor count + descriptions displayed
    - [x] Test link to `/instructor/assignments/${assignmentId}`
    - [x] Test empty state ("No students at risk" via `EmptyState`)
    - [x] Test sorted by severity
    - [x] Run `pnpm test` — confirm tests fail as expected

- [x] Task: Implement dashboard widget (Green) [commit: af2753e]
    - [x] Create at-risk widget component on instructor dashboard (`src/routes/_authenticated/instructor/dashboard.tsx`)
    - [x] `Badge` (yellow/orange/red), `Tooltip` for factor details, `EmptyState` when empty
    - [x] Run `pnpm test` — confirm tests pass

- [x] Task: Add i18n keys and validate [commit: af2753e]
    - [x] Add keys to `locales/en.json`: `notifications.events.student_at_risk.title`/`.message`, `emails.subjects.studentAtRisk`, `dashboard.atRisk.title`/`.empty`/`.factorCount`, `dashboard.atRisk.factors.*`, `analytics.atRiskSummary`
    - [x] Add same keys to `locales/id.json` with Indonesian translations
    - [x] Run `pnpm generate:i18n`
    - [x] Run `pnpm check:i18n` — verify parity
    - [x] Run `pnpm check:i18n:unused` — verify no new unused keys

- [x] Task: Final quality gate verification [commit: 4a5fcf0]
    - [x] Run `pnpm test:coverage` — 3441 tests pass, 88.28% stmts, 82.28% branches, 83.83% funcs, 88.92% lines
    - [x] Run `pnpm typecheck` — PASS
    - [x] Run `pnpm lint` — 0 errors (2 pre-existing warnings)
    - [x] Verify all files under 500 lines
    - [x] Refactored: wired `at-risk-email.ts` wrapper into `risk-alerts.ts` to eliminate dead code

- [x] Task: Conductor - User Manual Verification 'Phase 3: UI, Email & i18n' (Protocol in workflow.md) [checkpoint: 56ad74f2]

## Phase: Review Fixes
- [x] Task: Apply review suggestions <427f6da7>

</protect>
