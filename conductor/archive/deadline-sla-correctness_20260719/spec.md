<protect>
# Track: Deadline & SLA Logic Correctness

**Track ID:** `deadline-sla-correctness_20260719`
**Type:** Bug Fix
**Source:** `docs/roadmap.md` lines 111-159
**Audit IDs:** BUG-3, BUG-11, BUG-12, BUG-16, BUG-18, BUG-19, BUG-21, BUG-28

## Overview

This track fixes 8 logic correctness bugs in the deadline and SLA subsystem. The bugs span four areas: (1) stale docstrings claiming `finalDeadline` mutation that no longer occurs (Track 10 made it immutable), (2) incorrect date-arithmetic SQL, (3) missing validation in deadline/extension flows, and (4) incorrect `effectiveDeadline` derivation logic.

**Key Architectural Decision — `finalDeadline` Immutability (honors Track 10):**
`assignments.finalDeadline` is **course-wide** (one value shared by all students). Checkpoints are **per-student** (`checkpoints.studentId`). Extensions and SLA breaches are per-student operations. Bumping a course-wide deadline for one student's extension would incorrectly move the deadline for ALL students. Therefore `finalDeadline` remains **immutable** after assignment creation. Per-student effective deadlines are derived from checkpoint `dueDate` values, which DO move with extensions. The `finalDeadline >= max(checkpoint.dueDate)` invariant is enforced **only at assignment creation time**.

## Functional Requirements

### FR-1: Update Stale Docstrings (BUG-3)
Three functions have docstrings claiming they extend `assignments.finalDeadline`, but Track 10 removed that mutation. The implementations are correct; the docstrings are stale.

- **FR-1.1:** Update the docstring of `calculateExtensionAdjustment` in `src/server/extensions-extras.server.ts` (lines 23-26) to remove any claim of extending `finalDeadline`. Document that it adjusts per-student checkpoint `dueDate` values only.
- **FR-1.2:** Update the docstring of `adjustDeadlinesForBreach` in `src/lib/review-sla.ts` (lines 27-32) to remove any claim of extending `finalDeadline`. Document that it adjusts per-student checkpoint `dueDate` values only.
- **FR-1.3:** Update the docstring of `bulkExtendHandler` in `src/server/extensions-extras.server.ts` (lines 312-314) to remove any claim of extending `finalDeadline`.

### FR-2: Fix `daysOverdue` SQL Arithmetic (BUG-11)
`extract(day from now() - uploadedAt)` returns the day-component of an interval (wraps at ~30), not the total elapsed days.

- **FR-2.1:** In `src/server/dashboard-admin.server.ts` line 93, replace `extract(day from now() - ${submissions.uploadedAt})::int` with `EXTRACT(EPOCH FROM now() - ${submissions.uploadedAt}) / 86400` (cast to int).
- **FR-2.2:** In `src/server/dashboard-admin.server.ts` line 107 (ORDER BY), apply the same replacement.

### FR-3: Add `finalDeadline` Cap to `validateDueDates` (BUG-12)
`validateDueDates` validates sequential ordering and past dates but does not cap checkpoint dueDates against the assignment's `finalDeadline`.

- **FR-3.1:** Add an optional `finalDeadline?: Date` parameter to `validateDueDates` in `src/server/due-dates.server.ts`.
- **FR-3.2:** When `finalDeadline` is provided, reject any checkpoint `dueDate` that exceeds it. Throw a Zod-error-style validation error with a descriptive message.
- **FR-3.3:** Wire the `finalDeadline` argument at all assignment-creation call sites.
- **FR-3.4:** Do NOT enforce this cap in extension flows (`extendDeadlineHandler`, `approveExtensionHandler`) — per-student extensions legitimately push dueDates past the course-wide `finalDeadline`.

### FR-4: Fix SLA Docstring and Parameter Naming (BUG-16)
The SLA calculation is anchored at submission upload time (Track 9 H2 decision), but the docstring and parameter name say `under_review`.

- **FR-4.1:** Update the docstring in `src/lib/sla.ts` (lines 1-9) to state: "SLA is 3 calendar days from submission upload time."
- **FR-4.2:** Rename the `underReviewAt` parameter of `calculateBreachDuration` to `anchorTime`.
- **FR-4.3:** Rename the local variable in `submitReviewHandler` (`src/server/reviews.server.ts` line 397) from `underReviewAt` to `anchorTime`.

### FR-5: Add Validation to `extendDeadlineHandler` (BUG-18)
`extendDeadlineHandler` sets `newDueDate` with zero validation.

- **FR-5.1:** In `src/server/assignments-extras.server.ts` (lines 99-148), validate that `newDueDate` is in the future.
- **FR-5.2:** Validate that `newDueDate` maintains sequential ordering relative to adjacent checkpoints (the checkpoint being extended and any subsequent checkpoints that shift with it).
- **FR-5.3:** Return a descriptive validation error if either check fails.
- **FR-5.4:** Do NOT bump `assignments.finalDeadline` — it stays immutable per Track 10.

### FR-6: Fix `upcomingDeadlines` Query and Null `dueDate` Handling (BUG-19)
The student dashboard's upcoming deadlines query includes `passed` checkpoints, and null `dueDate` values are treated as overdue.

- **FR-6.1:** In `src/server/dashboard-student.server.ts` (lines 47-59), add a WHERE clause filtering out checkpoints with status `passed`.
- **FR-6.2:** In the dashboard data mapping (lines 174-181), handle null `dueDate` as "No deadline": set `isOverdue = false` and `daysRemaining = null` (or equivalent sentinel). Do NOT substitute `new Date()` for null.
- **FR-6.3:** Ensure the frontend `StudentDashboard` component gracefully displays "No deadline" (e.g., "—" or empty string) when `daysRemaining` is null.

### FR-7: Remove Dead Email Notification Rows (BUG-21)
`dispatchSLABreachNotifications` inserts `channel: 'email'` notification rows that are never consumed (the actual email goes through `sendSLAAlertEmail` → email queue).

- **FR-7.1:** In `src/lib/review-sla.ts` (lines 117-130), remove the INSERT that creates `channel: 'email'` notification rows for admins.
- **FR-7.2:** Keep the in-app notification INSERT (lines 99-115, `channel: 'in_app'`).
- **FR-7.3:** Keep the `sendSLAAlertEmail` call (lines 132-140) which routes through the email queue.

### FR-8: Fix `effectiveDeadline` Derivation (BUG-28)
Three locations derive `effectiveDeadline` as the highest-order checkpoint's `dueDate`. It should be the **first non-passed checkpoint's** `dueDate`.

- **FR-8.1:** In `src/server/assignments-extras.server.ts` (lines 220-224, `listStudentAssignmentsHandler`), change the `effectiveDeadlineMap` logic: for each assignment, find the first checkpoint (lowest `order`) with status != `passed`. Use its `dueDate`. If all checkpoints are `passed`, use the last checkpoint's (highest `order`) `dueDate`.
- **FR-8.2:** In `src/server/assignments-extras.server.ts` (lines 331-335, `getStudentAssignmentDetailHandler`), replace the `reduce` that finds the highest-order checkpoint with logic that finds the first non-passed checkpoint.
- **FR-8.3:** In `src/server/dashboard-student.server.ts` (lines 144-151, `getStudentDashboardDataHandler`), apply the same first-non-passed logic.
- **FR-8.4:** Extract a shared helper function (e.g., `computeEffectiveDeadline(checkpoints)`) to avoid duplicating this logic across three call sites.

## Non-Functional Requirements

- **NFR-1:** All changes must pass existing quality gates: `pnpm test` (80% coverage), `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`.
- **NFR-2:** No file may exceed 500 lines (enforced by `scripts/check-modularity.js`).
- **NFR-3:** All new user-visible strings must use i18n keys (custom lint rule `simak-i18n/no-hardcoded`).
- **NFR-4:** Tests must mock `@tanstack/react-start` with the builder chain pattern for server functions using `.inputValidator().handler()`.
- **NFR-5:** Changes must follow TDD: write failing tests first, then implement to make them pass.

## Acceptance Criteria

- [ ] **AC-1:** `calculateExtensionAdjustment`, `adjustDeadlinesForBreach`, and `bulkExtendHandler` docstrings make no claim of extending `finalDeadline`.
- [ ] **AC-2:** Admin dashboard `daysOverdue` correctly returns total elapsed days (e.g., 45 for a 45-day-old submission), verified by a unit test.
- [ ] **AC-3:** `validateDueDates` rejects checkpoint `dueDate` values exceeding `finalDeadline` when the parameter is provided (unit test with a past-`finalDeadline` input).
- [ ] **AC-4:** `validateDueDates` does NOT enforce the cap when `finalDeadline` is omitted (backward compatible).
- [ ] **AC-5:** `sla.ts` docstring says "from submission upload time"; parameter is named `anchorTime`.
- [ ] **AC-6:** `extendDeadlineHandler` rejects past dates with a validation error (unit test).
- [ ] **AC-7:** `extendDeadlineHandler` rejects non-sequential dueDates with a validation error (unit test).
- [ ] **AC-8:** `extendDeadlineHandler` does NOT modify `assignments.finalDeadline` (unit test asserting `finalDeadline` unchanged).
- [ ] **AC-9:** Student dashboard `upcomingDeadlines` excludes `passed` checkpoints (unit test).
- [ ] **AC-10:** Student dashboard handles null `dueDate` as "No deadline" with `isOverdue = false` (unit test).
- [ ] **AC-11:** `dispatchSLABreachNotifications` no longer inserts `channel: 'email'` rows (unit test asserting only `in_app` rows are inserted).
- [ ] **AC-12:** `effectiveDeadline` returns the first non-passed checkpoint's `dueDate` (unit test with mixed passed/non-passed checkpoints).
- [ ] **AC-13:** `effectiveDeadline` returns the last checkpoint's `dueDate` when all checkpoints are passed (unit test).
- [ ] **AC-14:** A shared helper `computeEffectiveDeadline` is used by all three call sites (no duplicated logic).
- [ ] **AC-15:** All quality gates pass: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`.

## Out of Scope

- **Mutating `finalDeadline`** — Track 10's immutability decision is honored. No mutation logic will be added.
- **Changing the SLA anchor point** — Track 9's decision (submission upload time) is kept. Only the docstring/param name is fixed.
- **Concurrency/locking** — Track 13 already added transaction safety. Not touched here.
- **UI redesign of dashboards** — Only the minimal display change for null `dueDate` ("No deadline" text) is in scope.
- **Notification system overhaul** — Only the dead `channel: 'email'` rows are removed. The in-app + email-queue paths remain as-is.
</protect>
