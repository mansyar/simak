<protect>
# Implementation Plan: Input Validation & Data Integrity

**Track ID:** `input-validation-data-integrity_20260719`
**Spec:** [./spec.md](./spec.md)

## Phase 1: Settings Zod Validation (BUG-15) [checkpoint: d6dafa9]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 1 implementation
    - [x] Read `./spec.md` — review FR-1 (Settings Zod Validation), NFR-4 (mock builder chain), and AC-1 through AC-5
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, quality gate requirements, and Phase Completion Verification Protocol

- [x] Task: Add .inputValidator() to settings.ts POST stubs and remove unsafe casts (BUG-15) — Commit: 2c0ceaf
    - [x] Write failing tests: in `tests/unit/server/settings.test.ts` (or new file mirroring src path), add tests that (1) `updateProfile` rejects `{ name: "" }` with Zod error, (2) `updateProfile` rejects oversized name strings, (3) `updateUserSettings` rejects non-boolean `reducedMotion` and unsupported `extension` values, (4) `getPresignedAvatarUploadUrl` validates input via Zod. Mock `@tanstack/react-start` with the builder chain pattern. Run `pnpm test` and confirm new tests fail as expected (validation not yet wired).
    - [x] Refactor `updateProfile` stub in `src/server/settings.ts` to use `.inputValidator(updateProfileSchema).handler(fn)`. Remove `args as { name: string }` cast from handler.
    - [x] Refactor `updateUserSettings` stub to use `.inputValidator(updateUserSettingsSchema).handler(fn)`. Remove `args as { extension: string }` cast.
    - [x] Refactor `getPresignedAvatarUploadUrl` stub to use `.inputValidator(getPresignedAvatarUploadUrlSchema).handler(fn)`. Remove `args as { reducedMotion: boolean }` cast.
    - [x] Verify existing Zod schemas in `settings.ts` cover the full input shape; extend if incomplete.
    - [x] Run `pnpm test` — confirm all tests pass (including new validation rejection tests)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [x] Grep assertion: no `args as { ... }` casts remain in `settings.ts` handlers
    - [x] Commit: `fix(settings): Wire Zod validation via inputValidator on POST stubs`
    - [x] Attach git note with task summary (list of changed files, core why, test count delta)
    - [x] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 1: Settings Zod Validation' (Protocol in workflow.md)

## Phase 2: Storage Discrimination, Env & i18n (BUG-10, BUG-25, BUG-27) [checkpoint: 96b52db]

- [x] Task: Read spec.md and workflow.md to prepare for Phase 2 implementation
    - [x] Read `./spec.md` — review FR-2 (R2 Error Discrimination), FR-3 (EMAIL_FROM), FR-6 (actualSize storage), FR-7 (new i18n keys), NFR-7 (no process.env outside env.ts/storage.ts), AC-6 through AC-12, AC-18 through AC-21
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, quality gate requirements

- [x] Task: Add new i18n keys for R2 error messages (BUG-10) — Commits: 2f876b1 (locales), 6df5f63 (regenerated types)
    - [x] Add `files.r2NotConfigured` to `locales/en.json` with value: "File storage is not configured. Contact your administrator."
    - [x] Add `files.r2NotConfigured` to `locales/id.json` with value: "Penyimpanan berkas tidak dikonfigurasi. Hubungi administrator Anda."
    - [x] Add `files.objectNotFound` to `locales/en.json` with value: "The uploaded file could not be found. Please try uploading again."
    - [x] Add `files.objectNotFound` to `locales/id.json` with value: "Berkas yang diunggah tidak ditemukan. Silakan coba unggah kembali."
    - [x] Run `pnpm generate:i18n` to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts`
    - [~] Run `pnpm check:i18n` — DEFERRED: keys reported as unused until Task 4 caller code uses them; will pass after Task 4
    - [x] Run quality gates: `pnpm typecheck && pnpm lint` (both pass)
    - [x] Commit: `feat(i18n): Add R2 error message keys for storage discrimination` (2f876b1) + `chore(i18n): Regenerate types for new R2 error keys` (6df5f63)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Refactor getObjectContentLength to discriminated return type (BUG-10) — Combined with Task 4 (tightly coupled). Commit: c68edb5
    - [x] Write failing tests: Updated `tests/unit/lib/storage.test.ts` with 6 tests (3 updated + 3 new) expecting discriminated return type
    - [x] Define the discriminated type: `GetObjectContentLengthResult` exported from `src/lib/storage.ts`
    - [x] Refactor `getObjectContentLength`: Returns `{ ok: false, reason: 'not_configured' }` when R2 not configured; try/catch on `client.send()` catches NotFound/404 → `{ ok: false, reason: 'not_found' }`; success → `{ ok: true, size }`. Added `isNotFoundError()` helper.
    - [x] Run `pnpm test` — all storage tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint` (both pass)
    - [x] Commit: `refactor(storage): Discriminate R2 errors and store actualSize` (c68edb5)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Update callers to handle all three branches + store actualSize (BUG-10, BUG-27) — Combined with Task 3. Commit: c68edb5 (+ fix 04a8540)
    - [x] Write failing tests: Added 2 new tests each in `submissions-intent.test.ts` (AC-H1-5, AC-H1-6) and `reviews-intent.test.ts` (AC-H1-6, AC-H1-7) for not_configured/not_found branches. Updated all existing mocks to discriminated type across 7 test files.
    - [x] Update `submitCheckpointHandler`: handles all 3 branches with `translateKey()` i18n messages; stores `sizeResult.size` in INSERT (replacing client-reported `fileSize`); removed unused `fileSize` variable
    - [x] Update `submitReviewHandler`: handles all 3 branches identically; added `translateKey` import; removed blank line to stay under 500-line limit
    - [x] Added `files.r2NotConfigured` and `files.objectNotFound` to `DYNAMIC_KEY_PATTERNS` in `scripts/check-i18n-keys.js`
    - [x] Run `pnpm test` — all 2424 tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` (all pass, 0 errors)
    - [x] Commit: `refactor(storage): Discriminate R2 errors and store actualSize` (c68edb5) + `fix(submissions): Remove unused fileSize variable` (04a8540)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Add EMAIL_FROM env validation (BUG-25)
    - [x] Write failing tests: in `tests/unit/config/env.test.ts`, add a test that the Zod schema rejects missing/empty `EMAIL_FROM` with the error message 'EMAIL_FROM is required'. Run `pnpm test` and confirm new tests fail.
    - [x] Add `EMAIL_FROM` to `baseSchema` in `src/config/env.ts` as `z.string({ error: 'EMAIL_FROM is required' }).min(1, 'EMAIL_FROM is required')` (Zod v4 API — uses `{ error }` not `{ required_error }`)
    - [x] Update `.env.example` with the placeholder: `EMAIL_FROM="SIMAK <noreply@simak.app>"`
    - [x] Replace `process.env.EMAIL_FROM` (and the `'SIMAK <noreply@simak.app>'` fallback) in `src/lib/email-queue-processor.ts` (~line 91) with `getEnv().EMAIL_FROM`
    - [x] Add `EMAIL_FROM="SIMAK <noreply@simak.app>"` to local `.env` (developer manual step — not committed)
    - [x] Run `pnpm test` — confirm env tests pass
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n`
    - [x] Grep assertion: no `process.env.EMAIL_FROM` and no `'SIMAK <noreply@simak.app>'` fallback in `email-queue-processor.ts`
    - [x] Commit: `fix(env): Add EMAIL_FROM to Zod-validated env schema` (b103c92)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Conductor - User Manual Verification 'Phase 2: Storage Discrimination, Env & i18n' (Protocol in workflow.md)

## Phase 3: Assignment & Ownership Validation (BUG-24, BUG-26)

- [x] Task: Read spec.md and workflow.md to prepare for Phase 3 implementation
    - [x] Read `./spec.md` — review FR-4 (studentIds Role Validation), FR-5 (instructorId WHERE Clause), AC-13 through AC-17, AC-22 (i18n key for invalidStudentIds)
    - [x] Read `conductor/workflow.md` — review TDD lifecycle, commit format, quality gate requirements

- [x] Task: Add studentIds role validation in createAssignmentHandler (BUG-24) — Commit: 8ae283c
    - [x] Add `assignments.errors.invalidStudentIds` to `locales/en.json` with value: "One or more selected users are not active students"
    - [x] Add `assignments.errors.invalidStudentIds` to `locales/id.json` with value: "Satu atau lebih pengguna terpilih bukan mahasiswa aktif"
    - [x] Run `pnpm generate:i18n` to regenerate i18n types
    - [x] Write failing tests: Added 3 rejection tests (admin, deleted student, instructor) + updated success test with validation mock in `tests/unit/assignments/creation.test.ts`. Updated `assignments-audit.test.ts` and `assignments-duration.test.ts` with validation query mocks.
    - [x] In `createAssignmentHandler`, before the transaction begins: execute `SELECT id FROM users WHERE id IN (studentIds) AND role='student' AND deletedAt IS NULL` using Drizzle's `inArray(users.id, studentIds)` parameterized query.
    - [x] Compare returned row count to `studentIds.length`. If mismatch, return `serverError(BAD_REQUEST, translateKey('assignments.errors.invalidStudentIds', locale))` BEFORE the transaction begins.
    - [x] Run `pnpm test` — confirm validation tests pass (11/11 in creation.test.ts)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` (all pass)
    - [x] Commit: `fix(assignments): Validate studentIds are active students before assignment creation` (8ae283c)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [x] Task: Move instructorId check into WHERE clause (BUG-26) — Commit: c1cff3a
    - [x] Write failing tests: Added 3 tests in `tests/unit/server/assignments-boundary.test.ts` — AC-16 grep (no JS post-query check), AC-16 grep (WHERE has instructorId filter), behavioral (null on zero rows). Run `pnpm test` and confirm 2 grep tests fail as expected.
    - [x] Add `eq(assignments.instructorId, session.user.id)` to the WHERE clause in `getAssignmentDetailHandler`.
    - [x] Remove the `select` on `assignments.instructorId` from the query.
    - [x] Remove the JS post-query check `if (assignment.instructorId !== session.user.id) throw notFound()`.
    - [x] Verify behavior is identical: non-owner receives `null` (zero rows → not found).
    - [x] Run `pnpm test` — confirm ownership tests pass (6/6 in assignments-boundary.test.ts)
    - [x] Run quality gates: `pnpm typecheck && pnpm lint && pnpm check:i18n` (all pass)
    - [x] Grep assertion: no JS post-query `instructorId !== session.user.id` check remains
    - [x] Commit: `refactor(assignments): Move instructorId ownership check into SQL WHERE clause` (c1cff3a)
    - [x] Attach git note with task summary
    - [x] Record commit SHA in plan.md

- [~] Task: Conductor - User Manual Verification 'Phase 3: Assignment & Ownership Validation' (Protocol in workflow.md)
</protect>
