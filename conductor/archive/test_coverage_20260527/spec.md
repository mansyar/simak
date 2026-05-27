# Specification: Increase Test Coverage to >80%

## Overview

This track aims to increase the SIMAK project's unit test coverage from the current ~57% to >80% across all metrics (statements, branches, functions, lines). The work involves adding unit tests to under-tested areas and updating the vitest coverage thresholds to enforce the new standard. Integration tests are excluded from this track and coverage scope.

## Functional Requirements

1. **Coverage Target:** Achieve >80% unit test coverage for statements, branches, functions, and lines.
2. **Test Type:** Unit tests only — isolated tests with mocked dependencies. No integration tests.
3. **Threshold Update:** Update `vitest.config.ts` coverage thresholds from 50% to 80% for all metrics.
4. **Priority Areas (ordered by gap severity):**
   - **Critical (0-20%):**
     - `routes/` (17%) — Route components, loaders, and guards
     - `server/auth.ts` (6%) — Auth helper functions
     - `server/send-password.ts` (0%) — Password setup handler
     - `server/files.server.ts` (0%) — File upload/download handlers
     - `hooks/use-theme.ts` (0%) — Theme hook
     - `i18n/index.ts` (5%) — i18n initialization
   - **High (20-50%):**
     - `server/assignments.ts` (43%) — Assignment stubs
     - `server/consultations.ts` (40%) — Consultation stubs
     - `server/notifications.ts` (40%) — Notification stubs
     - `server/submissions.ts` (40%) — Submission stubs
     - `server/templates.ts` (38%) — Template stubs
     - `server/users.ts` (40%) — User stubs
     - `components/reviews/ReviewForm.tsx` (27%) — Review form component
     - `db/schema/` (37-67%) — Schema relation definitions
   - **Medium (50-80%):**
     - `components/dashboard/StudentDashboard.tsx` (64%)
     - `components/files/file-uploader.tsx` (66%)
     - `components/reviews/DeadlineManager.tsx` (82% — close but needs branches)
5. **Test Patterns:** Follow existing test patterns:
   - Server function tests mock `getSessionFromHeaders` and `getDb`
   - Component tests use `@testing-library/react` with mocked server functions
   - Schema tests verify exported relations and types
6. **No Functional Changes:** This track adds tests only — no production code changes except threshold updates.

## Non-Functional Requirements

- Tests must pass with `pnpm vitest run`
- No new dependencies required
- Follow existing test file naming: `*.test.ts` / `*.test.tsx`
- Tests must be deterministic and not depend on external services

## Acceptance Criteria

1. `pnpm vitest run --coverage` shows >80% for all four metrics (statements, branches, functions, lines)
2. `vitest.config.ts` thresholds updated to 80%
3. All existing tests continue to pass
4. No production code behavior changes

## Out of Scope

- Integration tests (excluded from coverage)
- End-to-end (Playwright) tests
- Performance testing
- Refactoring production code to improve testability (unless strictly necessary)
- Testing `src/components/ui/` (excluded from coverage)
- Testing generated files (`routeTree.gen.ts`, `i18n/types.ts`, `i18n/detect-locale.ts`)
