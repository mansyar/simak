<protect>
# Track: Input Validation & Data Integrity

**Track ID:** `input-validation-data-integrity_20260719`
**Type:** Bug Fix
**Source:** `docs/roadmap.md` lines 163-213
**Audit IDs:** BUG-10, BUG-15, BUG-24, BUG-25, BUG-26, BUG-27

## Overview

This track fixes 6 input-validation and data-integrity bugs across the SIMAK codebase. The bugs span five areas: (1) settings server function stubs that bypass Zod validation via unsafe `args as { ... }` casts, (2) R2 storage errors being misreported as "file too large" because `getObjectContentLength` does not discriminate between not-configured, not-found, and too-large cases, (3) missing `EMAIL_FROM` env-var validation, (4) missing studentIds role validation in assignment creation, (5) `instructorId` ownership check done in JS post-query instead of SQL WHERE, and (6) storing client-reported `fileSize` instead of R2-verified `actualSize` in submission records.

**Architectural alignment:** This track enforces two existing project conventions — (a) the typed builder pattern `.inputValidator(Schema).handler(fn)` (Track 6.4 systemic type fix), and (b) server-resolved i18n for error messages (Track 9 pattern). BUG-27 is naturally resolved by the BUG-10 fix.

## Functional Requirements

### FR-1: Settings Zod Validation (BUG-15)
Three POST stubs in `src/server/settings.ts` (`updateProfile`, `updateUserSettings`, `getPresignedAvatarUploadUrl`) accept `args: unknown` and use unsafe casts (`args as { name: string }`, `args as { extension: string }`, `args as { reducedMotion: boolean }`) inside the handlers. This bypasses Zod validation entirely.

- **FR-1.1:** Refactor `updateProfile` stub to use the typed builder pattern `.inputValidator(updateProfileSchema).handler(fn)`. Remove the `args as { name: string }` cast from the handler. The handler receives typed args.
- **FR-1.2:** Refactor `updateUserSettings` stub to use `.inputValidator(updateUserSettingsSchema).handler(fn)`. Remove the `args as { extension: string }` cast.
- **FR-1.3:** Refactor `getPresignedAvatarUploadUrl` stub to use `.inputValidator(getPresignedAvatarUploadUrlSchema).handler(fn)`. Remove the `args as { reducedMotion: boolean }` cast.
- **FR-1.4:** `getCurrentUser` (GET, no input) is unchanged.
- **FR-1.5:** Reuse the existing Zod schemas already defined in `settings.ts` (do not duplicate). If a schema is missing or incomplete, extend it to cover the full input shape.

### FR-2: R2 Error Discrimination (BUG-10)
`getObjectContentLength` in `src/lib/storage.ts` returns `{ size } | null` (or throws). Callers cannot distinguish between R2-not-configured, object-not-found, and the actual-size case. The outer catch in `submitCheckpointHandler` falls back to the "file too large" message for all failures.

- **FR-2.1:** Refactor `getObjectContentLength` to return a discriminated type: `{ ok: true; size: number } | { ok: false; reason: 'not_configured' | 'not_found' }`.
- **FR-2.2:** When R2 is not configured (missing `R2_*` env vars), return `{ ok: false, reason: 'not_configured' }` instead of throwing or returning null.
- **FR-2.3:** Wrap `client.send(new HeadObjectCommand(...))` in a try/catch. Catch the 404 (NotFound) error and return `{ ok: false, reason: 'not_found' }`. Let other unexpected errors propagate to the outer catch (do not swallow them).
- **FR-2.4:** The "file too large" message (`files.tooLarge` or equivalent existing key) is shown ONLY when `actualSize > MAX_FILE_SIZE` — i.e., only in the `{ ok: true, size }` branch where `size > MAX_FILE_SIZE`.
- **FR-2.5:** Update caller in `src/server/submissions.server.ts` (~line 140, `submitCheckpointHandler`) to handle all three result branches: `not_configured` → `serverError(BAD_REQUEST, t('files.r2NotConfigured'))`, `not_found` → `serverError(BAD_REQUEST, t('files.objectNotFound'))`, `{ ok: true, size }` with `size > MAX_FILE_SIZE` → existing too-large error.
- **FR-2.6:** Update caller in `src/server/reviews.server.ts` (~line 333, `submitReviewHandler` feedback-file path) to handle all three result branches identically.

### FR-3: EMAIL_FROM Env Validation (BUG-25)
`EMAIL_FROM` is read via `process.env.EMAIL_FROM` in `src/lib/email-queue-processor.ts` (~line 91) with a fallback to `'SIMAK <noreply@simak.app>'`. If the env var is missing or empty, emails silently use the fallback instead of failing fast.

- **FR-3.1:** Add `EMAIL_FROM` to `baseSchema` in `src/config/env.ts` as `z.string().min(1, 'EMAIL_FROM is required')`.
- **FR-3.2:** Update `.env.example` with the placeholder: `EMAIL_FROM="SIMAK <noreply@simak.app>"` (RFC 5322 display-name format).
- **FR-3.3:** Replace `process.env.EMAIL_FROM` (and its fallback) in `src/lib/email-queue-processor.ts` (~line 91) with `getEnv().EMAIL_FROM`. Remove the `'SIMAK <noreply@simak.app>'` fallback string.
- **FR-3.4:** Add `EMAIL_FROM` to the local `.env` (developer manual step — not committed; developer adds their own value or copies from `.env.example`).

### FR-4: studentIds Role Validation (BUG-24)
`createAssignmentHandler` accepts `studentIds` and inserts rows into `assignmentStudents` without verifying that each ID corresponds to an active student (`role='student'` AND `deletedAt IS NULL`). An admin or instructor userId could be added as a "student".

- **FR-4.1:** Before the transaction begins in `createAssignmentHandler`, execute a single validation query: `SELECT id FROM users WHERE id IN (studentIds) AND role='student' AND deletedAt IS NULL`.
- **FR-4.2:** Compare the returned row count to `studentIds.length`. If they mismatch, return `serverError(BAD_REQUEST, t('assignments.errors.invalidStudentIds'))` BEFORE the transaction begins.
- **FR-4.3:** Add the i18n key `assignments.errors.invalidStudentIds` to both `locales/en.json` (value: "One or more selected users are not active students") and `locales/id.json` (value: "Satu atau lebih pengguna terpilih bukan mahasiswa aktif").
- **FR-4.4:** Run `pnpm generate:i18n` to regenerate i18n types.
- **FR-4.5:** The validation query must use a parameterized Drizzle query (`inArray(users.id, studentIds)`), never raw string interpolation.

### FR-5: instructorId WHERE Clause (BUG-26)
`getAssignmentDetailHandler` (instructor scope) SELECTs the `instructorId` column and performs a JS post-query check `if (assignment.instructorId !== session.user.id) throw notFound()`. This is wasteful and leaks the column to the response shape.

- **FR-5.1:** Add `eq(assignments.instructorId, session.user.id)` to the WHERE clause of the query in `getAssignmentDetailHandler`.
- **FR-5.2:** Remove the `select` on `assignments.instructorId` from the query.
- **FR-5.3:** Remove the JS post-query check `if (assignment.instructorId !== session.user.id) throw notFound()`.
- **FR-5.4:** Behavior must remain identical: a non-owner instructor receives a `notFound()` (zero rows returned → not found).

### FR-6: Store actualSize in Submissions (BUG-27)
`submitCheckpointHandler` stores `fileSize` (client-reported) in the `submissions` INSERT. This is naturally resolved by FR-2 — only the `{ ok: true, size }` case proceeds to INSERT; `not_configured` and `not_found` are rejected with their specific messages.

- **FR-6.1:** In the `submissions` INSERT inside `submitCheckpointHandler`, replace `fileSize` (client-reported) with `actualSize` (the `size` field from the `{ ok: true, size }` discriminated result).
- **FR-6.2:** No cross-validation between client-reported `fileSize` and R2-verified `actualSize` (encoding differences may cause minor mismatches — accepted tradeoff per roadmap decision).
- **FR-6.3:** Existing submission rows in the DB are NOT backfilled — only new INSERTs use `actualSize`.

### FR-7: New i18n Keys (BUG-10)
Two new i18n keys are required for the R2 error discrimination messages.

- **FR-7.1:** Add `files.r2NotConfigured` to `locales/en.json` with value: "File storage is not configured. Contact your administrator."
- **FR-7.2:** Add `files.r2NotConfigured` to `locales/id.json` with value: "Penyimpanan berkas tidak dikonfigurasi. Hubungi administrator Anda."
- **FR-7.3:** Add `files.objectNotFound` to `locales/en.json` with value: "The uploaded file could not be found. Please try uploading again."
- **FR-7.4:** Add `files.objectNotFound` to `locales/id.json` with value: "Berkas yang diunggah tidak ditemukan. Silakan coba unggah kembali."
- **FR-7.5:** Run `pnpm generate:i18n` after adding keys.
- **FR-7.6:** Verify `pnpm check:i18n` passes (EN↔ID parity).

## Non-Functional Requirements

- **NFR-1:** All changes must pass existing quality gates: `pnpm test` (≥80% coverage on lines/statements/branches/functions), `pnpm typecheck`, `pnpm lint` (including `simak-i18n/no-hardcoded`), `pnpm check:i18n`.
- **NFR-2:** No file may exceed 500 lines (enforced by `scripts/check-modularity.js`).
- **NFR-3:** All new user-visible strings must use i18n keys (custom lint rule `simak-i18n/no-hardcoded`).
- **NFR-4:** Tests must mock `@tanstack/react-start` with the builder chain pattern (`createServerFn().inputValidator().handler(fn)`) for server functions using `.inputValidator().handler()`. Canonical pattern in `tests/unit/server/submissions.test.ts`.
- **NFR-5:** Changes must follow TDD: write failing tests first, then implement to make them pass.
- **NFR-6:** Server functions follow the two-file split: `src/server/<feature>.ts` (Zod schemas + `createServerFn` stubs with dynamic import) and `src/server/<feature>.server.ts` (handler implementations). The settings stubs already exist — only the validation wiring changes.
- **NFR-7:** No `process.env` reads outside of `src/config/env.ts` (Zod-validated) and `src/lib/storage.ts` (R2 client SDK initialization). The `email-queue-processor.ts:91` `process.env.EMAIL_FROM` is removed and replaced with `getEnv().EMAIL_FROM`.

## Acceptance Criteria

- [ ] **AC-1:** `updateProfile` rejects `{ name: "" }` with a Zod validation error (unit test).
- [ ] **AC-2:** `updateProfile` rejects oversized name strings with a Zod validation error (unit test).
- [ ] **AC-3:** `updateUserSettings` rejects non-boolean `reducedMotion` and unsupported `extension` values with Zod validation errors (unit test).
- [ ] **AC-4:** `getPresignedAvatarUploadUrl` validates its input via Zod (unit test).
- [ ] **AC-5:** No `args as { ... }` casts remain in `settings.ts` handlers (grep assertion).
- [ ] **AC-6:** `getObjectContentLength` returns `{ ok: false, reason: 'not_configured' }` when R2 env vars are missing (unit test).
- [ ] **AC-7:** `getObjectContentLength` returns `{ ok: false, reason: 'not_found' }` when R2 returns 404 (unit test mocking the S3 client).
- [ ] **AC-8:** `getObjectContentLength` returns `{ ok: true, size }` on a successful HEAD response (unit test).
- [ ] **AC-9:** `submitCheckpointHandler` returns the `files.r2NotConfigured` i18n message when R2 is not configured (unit test).
- [ ] **AC-10:** `submitCheckpointHandler` returns the `files.objectNotFound` i18n message when R2 returns 404 (unit test).
- [ ] **AC-11:** `submitCheckpointHandler` returns the existing "file too large" error ONLY when `actualSize > MAX_FILE_SIZE` (unit test).
- [ ] **AC-12:** `submitReviewHandler` feedback-file path handles all three result branches identically to `submitCheckpointHandler` (unit test).
- [ ] **AC-13:** `createAssignmentHandler` rejects `studentIds` containing an admin userId with `assignments.errors.invalidStudentIds` (unit test).
- [ ] **AC-14:** `createAssignmentHandler` rejects `studentIds` containing a deleted student userId with `assignments.errors.invalidStudentIds` (unit test).
- [ ] **AC-15:** `createAssignmentHandler` accepts `studentIds` where ALL IDs are active students (unit test).
- [ ] **AC-16:** `getAssignmentDetailHandler` returns `notFound()` for a non-owner instructor without SELECTing `instructorId` or doing a JS post-query check (unit test).
- [ ] **AC-17:** `getAssignmentDetailHandler` returns the assignment for the owning instructor (unit test).
- [ ] **AC-18:** `submitCheckpointHandler` stores `actualSize` (R2-verified) instead of `fileSize` (client-reported) in the `submissions` INSERT (unit test).
- [ ] **AC-19:** Starting the app without `EMAIL_FROM` set fails with a Zod env validation error (manual or integration check).
- [ ] **AC-20:** `.env.example` contains `EMAIL_FROM="SIMAK <noreply@simak.app>"`.
- [ ] **AC-21:** `email-queue-processor.ts` uses `getEnv().EMAIL_FROM` with no fallback string (grep assertion — no `process.env.EMAIL_FROM` and no `'SIMAK <noreply@simak.app>'` fallback).
- [ ] **AC-22:** `locales/en.json` and `locales/id.json` contain `files.r2NotConfigured`, `files.objectNotFound`, and `assignments.errors.invalidStudentIds` keys with the specified values.
- [ ] **AC-23:** `pnpm check:i18n` passes (EN↔ID parity).
- [ ] **AC-24:** All quality gates pass: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:i18n`.

## Out of Scope

- **Moving R2 HEAD check outside the DB transaction (BUG-14)** — deferred to TRACK-006 as it is a performance issue, not a correctness issue. This track only fixes the error discrimination, not the transaction placement.
- **Concurrency/locking fixes for settings/assignment handlers** — covered by TRACK-001 (Track 13) where applicable.
- **Backfilling existing submission records' `fileSize` → `actualSize`** — only new INSERTs use `actualSize`.
- **Cross-validation between client-reported `fileSize` and R2-verified `actualSize`** — explicitly not done (encoding differences may cause minor mismatches; accepted tradeoff).
- **Changing the `submissions` schema** — `fileSize` column stays as-is; only the value written to it changes (now sourced from R2 HEAD instead of client report).
- **UI redesign of the Settings page** — only the server-side validation wiring changes; the Settings UI components are untouched.
- **Adding `EMAIL_FROM` to the production deployment env var list** — that is a deployment/ops task, not a code change. The 6 required env vars listed in `workflow.md` are unchanged at the documentation level (though `EMAIL_FROM` becomes the 7th required env var at runtime via Zod).
</protect>
