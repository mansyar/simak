<protect>

# Implementation Plan: Bulk Import for Users & Templates

Tracks the TDD lifecycle from `conductor/workflow.md` (Write failing tests → Implement → Verify coverage) for each task. Each phase ends with the Phase Completion Verification & Checkpointing Protocol.

## Phase 1: Foundation — Tech Stack & Dependency Setup [checkpoint: 8713e3f]

- [x] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [x] Task: Document SheetJS dependency in `conductor/tech-stack.md`
    - [ ] Add SheetJS (`xlsx`) row to the Frontend table (purpose: client-side .xlsx parsing + sample-file generation) with a dated note, per workflow rule "tech-stack changes documented before implementation"
- [x] Task: Install SheetJS dependency
    - [ ] Run `pnpm add xlsx` and verify import works (`import * as XLSX from 'xlsx'`)
    - [ ] Confirm no client/server split violation (SheetJS is client-only; never imported by `.server.ts` files)
- [x] Task: Conductor - User Manual Verification 'Foundation — Tech Stack & Dependency Setup' (Protocol in workflow.md)

## Phase 2: Bulk-Import Server Functions (Schemas + Handlers + Tests)

- [x] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [x] Task: Bulk user import handler — TDD c73eb63
    - [x] Write failing tests in `tests/unit/server/bulk-import-users.test.ts` covering: all-valid success, partial-failure (invalid rows skipped), email uniqueness (excluding soft-deleted), role-permission rules (Admin cannot create `admin`; `superadmin` never creatable), row-limit (>500 rejected), invitation email enqueue via existing queue, audit log `user.bulk_created` written, session/role verified
    - [x] Implement `BulkUserRowSchema` + `BulkCreateUsersSchema` (Zod) and `bulkCreateUsers` server-fn stub in `src/server/bulk-import.ts`
    - [x] Implement `bulkCreateUsersHandler` in `src/server/bulk-import.server.ts` (reuse existing `createUserHandler` validation/creation logic — extract shared helper if needed to avoid duplication; enqueue invitation emails; write audit log; return `{ created, skipped, errors }`)
    - [x] Run tests green; verify coverage >80% for the handler
- [x] Task: Bulk template import handler — TDD
    - [x] Write failing tests in `tests/unit/server/bulk-import-templates.test.ts` covering: all-valid success, per-group atomicity (one bad checkpoint skips whole template, others import), invalid group (missing/duplicate name, inconsistent type, <1 checkpoint), row-limit, audit log `template.bulk_created`, session/role verified
    - [x] Implement `BulkTemplateRowSchema` + `BulkCreateTemplatesSchema` (Zod, with grouping shape) and `bulkCreateTemplates` server-fn stub in `src/server/bulk-import.ts`
    - [x] Implement `bulkCreateTemplatesHandler` in `src/server/bulk-import.server.ts` (group rows by `templateName`, validate each group against `CreateTemplateSchema`, create template + checkpoints in a transaction reusing the `createTemplateHandler` pattern; write audit log; return `{ created, skipped, errors }`)
    - [x] Run tests green; verify coverage >80% for the handler
- [x] Task: Conductor - User Manual Verification 'Bulk-Import Server Functions' (Protocol in workflow.md) 6d7379a

## Phase 3: Client-Side Parsing, Validation & Sample Generation (Tests) [checkpoint: 6d7379a]

- [x] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [~] Task: User .xlsx parser + validator — TDD
    - [x] Write failing tests in `tests/unit/lib/parse-users-xlsx.test.ts` covering: header validation (exact `name|email|role`), trim whitespace, lowercase email/role, per-row validation statuses, row-limit enforcement, empty-sheet handling
    - [x] Implement `parseUsersXlsx(file)` + `validateUserRow(row, actorRole)` in `src/lib/bulk-import/parse-users.ts`
- [x] Task: Template .xlsx parser/grouper + validator — TDD
    - [x] Write failing tests in `tests/unit/lib/parse-templates-xlsx.test.ts` covering: header validation, group-by-`templateName`, type-consistency within group, checkpoint name non-empty, `minConsultations` default 0 / `estimatedDuration` default 7, numeric validation, per-group validity status, row-limit
    - [x] Implement `parseTemplatesXlsx(file)` + `groupByTemplate(rows)` + `validateTemplateGroup(group)` in `src/lib/bulk-import/parse-templates.ts`
- [~] Task: Sample-file generators — TDD
    - [x] Write failing tests in `tests/unit/lib/sample-generators.test.ts` covering: user sample has headers + 1 example row; template sample has headers + example checkpoint rows; output is a valid .xlsx blob
    - [x] Implement `generateUserSampleXlsx()` + `generateTemplateSampleXlsx()` in `src/lib/bulk-import/samples.ts` (SheetJS `write` → Blob; no server round-trip)
- [x] Task: Conductor - User Manual Verification 'Client-Side Parsing, Validation & Sample Generation' (Protocol in workflow.md) f663787

## Phase 4: Bulk User Import UI [checkpoint: f663787]

- [x] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [~] Task: User import route + dropzone — TDD
    - [x] Write failing component tests in `tests/unit/routes/admin-users-import.test.tsx` covering: only `.xlsx` accepted, 5MB size guard, non-xlsx rejected at dropzone with message, row-limit rejection message
    - [x] Implement `/admin/users/import` route + `BulkUserDropzone` component (reuse existing `FileUploader` patterns where applicable; xlsx-only accept)
- [~] Task: Preview table + commit + result report — TDD
    - [x] Write failing component tests covering: preview renders parsed rows with per-row Valid/Invalid status, commit calls `bulkCreateUsers`, loading state, result summary card (created/skipped) + error table with row/email/reason
    - [x] Implement `BulkUserPreviewTable`, commit handler (TanStack Query mutation), and `BulkImportResult` report card
    - [x] Wire "Download sample" link calling `generateUserSampleXlsx()`
- [~] Task: Wire entry point on `/admin/users`
    - [x] Add "Bulk Import" button to the users page header linking to `/admin/users/import`
- [x] Task: Conductor - User Manual Verification 'Bulk User Import UI' (Protocol in workflow.md)

## Phase 5: Bulk Template Import UI [checkpoint: 047b6fc]

- [x] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [x] Task: Template import route + dropzone — TDD
    - [x] Write failing component tests in `tests/unit/routes/admin-templates-import.test.tsx` covering: xlsx-only acceptance, 5MB guard, row-limit rejection
    - [x] Implement `/admin/templates/import` route + `BulkTemplateDropzone` component
- [x] Task: Grouped preview + commit + result report — TDD
    - [x] Write failing component tests covering: preview grouped by template with expandable rows showing checkpoints, per-template Valid/Invalid status, commit calls `bulkCreateTemplates`, loading state, result summary + error table (templateName/reason)
    - [x] Implement `BulkTemplatePreviewTable` (expandable per-template rows), commit handler (TanStack Query mutation), `BulkImportResult` reuse
    - [x] Wire "Download sample" link calling `generateTemplateSampleXlsx()`
- [x] Task: Wire entry point on `/admin/templates`
    - [x] Add "Bulk Import" button to the templates page header linking to `/admin/templates/import`
- [x] Task: Conductor - User Manual Verification 'Bulk Template Import UI' (Protocol in workflow.md)
  - Commit SHA: 1e2bf04
  - 8 tests passed, 2138 full suite, TypeScript clean, 0 errors

## Phase 6: i18n, Quality Gates & Final Verification [checkpoint: 1e2bf04]

- [ ] Task: Read `spec.md` (track requirements) and `conductor/workflow.md` (TDD, commit format, verification protocol) before starting this phase
- [ ] Task: Add i18n keys + EN/ID values — TDD
    - [ ] Write failing i18n regression test (all new bulk-import keys present in both `locales/en.json` and `locales/id.json`)
    - [ ] Add keys to `scripts/generate-i18n-types.ts`, values to both locale files, run `pnpm generate:i18n`
- [ ] Task: Full quality gate
    - [ ] Run `pnpm typecheck` — clean
    - [ ] Run `pnpm lint` — clean
    - [ ] Run `pnpm vitest run --coverage` — all tests pass; thresholds met (lines 80%, functions 80%, branches 72%, statements 79%)
    - [ ] Run modularity check (`node scripts/check-modularity.js`) — no file >500 lines
- [ ] Task: Conductor - User Manual Verification 'i18n, Quality Gates & Final Verification' (Protocol in workflow.md)

</protect>
