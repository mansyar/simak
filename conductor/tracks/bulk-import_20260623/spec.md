# Track: Bulk Import for Users & Templates

## Overview

Add the ability for Admins to bulk-create **users** and **assignment templates** by uploading a single `.xlsx` spreadsheet per entity. This extends two existing single-create flows:
- Track 2.1 (User Management) — `/admin/users`
- Track 2.2 (Assignment Templates) — `/admin/templates`

Each import follows the same lifecycle: **Upload .xlsx → client-side parse + validation → preview table with per-row status → commit → per-entity result report**. Invalid rows are skipped (partial success); the user receives a detailed report of what was created and what failed and why.

**File format:** `.xlsx` only (CSV is out of scope). Client-side parsing via SheetJS; the server receives only validated structured rows — it never receives file bytes (consistent with the project's "server never sees file bytes" philosophy).

## Functional Requirements

### FR-1: Bulk User Import
- Accessible from `/admin/users` via a "Bulk Import" action; opens a dedicated import route (`/admin/users/import`).
- Accepted file: `.xlsx`, single sheet, header row: `name | email | role`.
  - `role` must be one of `admin`, `instructor`, `student` (case-insensitive). `superadmin` is not creatable via import (matches single-create rules).
- Client parses via SheetJS, trims whitespace, lowercases email/role.
- Client validates each row: name non-empty, email format, role valid + creatable-by-actor.
- Preview table shows all rows with inline status: Valid / Invalid (with reason).
- On commit, sends the validated rows array to a `bulkCreateUsers` server function.
- Server re-validates every row (never trusts client): email format, role enum, role-permission rules (SuperAdmin may create `admin`; Admins may only create `instructor`/`student`), email uniqueness (excluding soft-deleted users).
- **Partial success (per-row):** valid users are created; invalid rows are skipped. Result report: `{ created: N, skipped: M, errors: [{ row, email, reason }] }`.
- Each created user triggers the existing invitation email flow (`sendInvitationEmail`), which enqueues via the existing email queue (Track 4.1) — no synchronous email bursts.

### FR-2: Bulk Template Import
- Accessible from `/admin/templates` via a "Bulk Import" action; opens a dedicated import route (`/admin/templates/import`).
- Accepted file: `.xlsx`, single sheet, header row: `templateName | type | checkpointName | minConsultations | estimatedDuration`.
  - Rows sharing the same `templateName` are grouped into one template. `type` must be consistent across all rows of a group (else the group is invalid).
  - `minConsultations` defaults to 0, `estimatedDuration` defaults to 7 if blank (matches `CheckpointInputSchema` defaults).
- Client parses, groups rows by `templateName`, validates each group (name/type non-empty + consistent, ≥1 checkpoint, checkpoint names non-empty, numeric fields valid).
- Preview table shows one expandable row per template with its checkpoints and per-template validity status.
- On commit, sends the grouped templates array to a `bulkCreateTemplates` server function.
- Server re-validates every group against `CreateTemplateSchema` and creates each valid template + checkpoints in a single transaction (reusing the existing `createTemplateHandler` transactional pattern).
- **Partial success (per-template-group atomicity):** if any checkpoint in a group is invalid, the whole template is skipped; other valid templates still import. Result report: `{ created: N, skipped: M, errors: [{ templateName, reason }] }`.

### FR-3: Shared Import UX
- **Preview before commit:** a review screen is always shown after parsing, before any DB writes.
- **Downloadable sample files:** a "Download sample" link on each import page produces a ready-to-use `.xlsx` with correct headers + one example row. Generated client-side via SheetJS (no server round-trip).
- **Row-limit guard:** max 500 rows per upload (users) / 500 checkpoint rows (templates); exceeding shows a clear error and blocks commit. A 5MB file-size guard also applies.
- **Format enforcement:** only `.xlsx` accepted; other extensions rejected at the dropzone with a clear message.
- **Progress + result:** commit shows a loading state; on completion, a result summary card (created/skipped counts) + a visible error table.
- **Audit logging:** each bulk import logs an audit event (`user.bulk_created`, `template.bulk_created`) with counts, per the existing audit-log pattern (Track 1.1).

## Non-Functional Requirements

- **New dependency:** SheetJS (`xlsx`) for client-side .xlsx parsing AND sample-file generation. Must be documented in `conductor/tech-stack.md` before implementation.
- **Server function split:** new `src/server/bulk-import.ts` (Zod schemas + `createServerFn` stubs) and `src/server/bulk-import.server.ts` (handlers only) — per the project's mandatory server-fn split.
- **Client bundling:** parsing logic stays client-side; server handlers never import SheetJS.
- **i18n:** all user-facing strings in EN + ID via `typesafe-i18n`; run `pnpm generate:i18n` after adding keys.
- **File limits:** max 500 rows, 5MB file size.
- **Security:** server re-validates all inputs; role-permission rules enforced per row/group; session + role verified (`requireRole(['superadmin','admin'])`).
- **Tests:** TDD per `workflow.md`; unit tests for parsers, validators, both handlers (success, partial-failure, permission denial, row-limit); coverage >80%.
- **Modularity:** ≤500 lines per file.

## Acceptance Criteria

1. An admin can upload an `.xlsx` of users and see a preview with per-row validation before any user is created.
2. Committing a user import creates all valid users, skips invalid ones, enqueues invitation emails for each, and shows a report (created/skipped counts + per-error reasons).
3. An admin can upload an `.xlsx` of templates (one row per checkpoint, grouped by `templateName`) and see a preview grouped by template before any template is created.
4. Committing a template import creates all valid template groups (each with its checkpoints) atomically, skips invalid groups, and shows a report.
5. Role-permission rules are enforced: an Admin cannot bulk-create `admin` users; `superadmin` is never creatable via import.
6. A downloadable sample `.xlsx` with correct headers + one example row is available on both import pages.
7. Uploads exceeding 500 rows or 5MB are rejected with a clear message; non-`.xlsx` files are rejected at the dropzone.
8. All UI strings are available in EN and ID; `pnpm generate:i18n` + locale files updated.
9. All tests pass; coverage thresholds met; `pnpm typecheck` + `pnpm lint` clean.

## Out of Scope

- CSV support (xlsx only).
- Bulk update / delete / upsert of existing users or templates (import = create only).
- Deduplication against existing DB templates by name (matches single-create: duplicate names allowed).
- Bulk assignment creation (only users and templates).
- A single combined workbook importing users + templates together (two separate imports).
- Email content customization for bulk-created users (uses existing invitation template).
