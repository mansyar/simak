# UI/UX Audit Remediation Baseline

Date: 2026-08-04

## Scope inventory

| Surface | Routes or components | Baseline targets |
| --- | --- | --- |
| Public and authentication | `/`, `/auth/login`, password and setup-password flows | Responsive layout, bilingual controls, form feedback, hydration and console errors |
| Shared shell | `__root.tsx`, `app-header.tsx`, role sidebars, `page-header.tsx`, `tabs.tsx`, `dialog.tsx`, `sheet.tsx`, shared buttons and inputs | Keyboard access, focus management, ARIA state, hit areas, clipping, dark mode |
| Student | Dashboard, assignments list/detail, checkpoint submission, discussions, settings, notifications | Next Actions, dates/timezone, checkpoint states, upload, tabs, empty/error states |
| Instructor | Dashboard, assignments list/detail/wizard, review queue/detail/form, settings, notifications | Header actions, filters, review workflow, uploads, responsive density, status feedback |
| Admin | Dashboard, users/import, templates/import/detail, audit log, email queue, analytics, settings | Import controls, expandable rows, destructive actions, wide data views, error recovery |
| Cross-cutting | `file-uploader.tsx`, notification center, date formatting, i18n, reduced motion | Keyboard-safe file selection, localized feedback, semantic tokens, motion preference |

## Fixtures

The E2E database is seeded by `scripts/seed-e2e.ts` through `tests/e2e/global-setup.ts`.
It provides `superadmin`, `admin`, two instructors, and three students, plus the E2E
template, assignment, checkpoints, enrollment, consultation, and feedback snippets.
Non-superadmin E2E accounts use the credentials defined by the E2E helper. These
fixtures remain isolated from the production seed entry point.

Existing reusable coverage includes:

- `tests/e2e/a11y.spec.ts`
- `tests/e2e/mobile.spec.ts`
- Role authentication and storage-state helpers in `tests/e2e/helpers/auth.ts`
- Existing unit tests for shell, upload, tabs, page header, imports, and security headers

## Automated baseline

Command:

```text
CI=1 pnpm exec playwright test tests/e2e/a11y.spec.ts tests/e2e/mobile.spec.ts --project=chromium --reporter=line
```

The first run reused an already-running development server connected to the normal
development database, while global setup seeded the E2E database. That run produced
authentication 401s and is treated as an environment diagnostic, not a product result.
After stopping that server and rerunning with `CI=1`, Playwright started the configured
E2E server and authenticated fixtures correctly.

The authoritative baseline result was:

- 9 test cases collected
- 7 passed
- 1 flaky test that passed on retry
- 1 failed test
- The failed test was the admin templates axe scan due to a moderate `heading-order`
  violation on the `E2E Thesis Template` heading rendered as an `h3`.
- No critical or serious axe violation was reported by the failing scan.
- Mobile dashboard and assignment-detail coverage executed against the seeded fixtures.

## Runtime findings

The authenticated run repeatedly logged a server/client hydration mismatch for the
ThemeScript nonce:

```text
server nonce=""
client nonce="<generated nonce>"
```

The mismatch was observed on public and authenticated route renders. TanStack Router
also emitted a warning that `HomePage` exports from `src/routes/index.tsx` are not
code-split; this is recorded as a non-blocking bundle warning unless later evidence
shows an interaction impact.

## Baseline conclusion

The E2E fixture and server-start path are usable when the existing development server
is not reused. The current unresolved quality gates are the ThemeScript hydration
mismatch and the admin template heading hierarchy violation. The static and authenticated
audit findings listed in `spec.md` remain the implementation target.
