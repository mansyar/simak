# TRACK-055: Student Timezone & iCalendar Support

## Overview

Students currently see deadline dates through locale formatting without an explicit display timezone and cannot subscribe to their SIMAK deadlines in a calendar application. This track adds student-local deadline presentation and a private, read-only iCalendar feed without changing stored deadline instants, reminder calculations, checkpoint gating, or non-student date surfaces.

- **Type:** Feature
- **Audit reference:** UX-44, deferred from TRACK-013
- **Dependencies:** Coordinate with TRACK-013 date-display work and TRACK-053 student deadline surfaces
- **Estimated effort:** 10–16 days / 4–6 sprint loops

## Functional Requirements

### FR-1: Student timezone preference

1. Extend the existing `users.settings` JSONB boundary with an optional validated IANA timezone.
2. After hydration, detect the browser’s IANA timezone.
3. Before detection completes, render a neutral placeholder rather than server/client-dependent date text.
4. Persist a valid detected timezone through the existing read-modify-write settings handler.
5. Provide a student-facing manual override using valid IANA timezone values.
6. Use UTC when detection is unavailable, invalid, or no valid preference exists.
7. Never reinterpret, rewrite, or migrate stored deadlines because of the display preference.
8. Preserve unrelated settings such as reduced-motion and notification preferences during updates.

### FR-2: Student deadline presentation

1. Apply the saved/detected timezone only to defined student deadline surfaces:
   - Student dashboard deadline widgets.
   - Student assignment and checkpoint deadline displays.
2. Use explicit timezone-aware formatting with locale-aware English/Indonesian output.
3. Preserve existing overdue, relative-time, effective-deadline, and null-deadline semantics.
4. Leave instructor/admin surfaces and non-deadline student history dates unchanged unless explicitly required by the selected deadline surface.
5. Keep deadline reminder scanning and all server-side comparisons based on authoritative stored UTC instants.

### FR-3: Calendar feed lifecycle

1. Add a student-only feed-management UI in the existing settings experience.
2. Keep the feed disabled until the student explicitly enables it.
3. On enablement, create one high-entropy opaque bearer credential for that student.
4. Store only a one-way hash of the credential in a dedicated token table.
5. Expose a copyable subscription URL only after successful creation.
6. Allow regeneration with confirmation; regeneration invalidates the previous credential.
7. Allow revocation/disablement; revoked credentials must stop working.
8. Enforce at most one active credential per student.
9. Never display or log plaintext credentials after the creation/regeneration response.
10. Record credential lifecycle actions in the audit log without storing the credential.

### FR-4: Private iCalendar endpoint

1. Add a route-level read-only iCalendar endpoint authenticated by the opaque bearer credential, so calendar clients do not need a browser session.
2. Invalid, missing, revoked, or otherwise unauthorized credentials must receive a generic failure response that does not reveal account or assignment details.
3. The endpoint must return only the credential owner’s authorized student assignments.
4. Include every checkpoint that:
   - Belongs to an active assignment for the student.
   - Has a due date.
   - Is not in the `passed` state.
5. Include locked future checkpoints and overdue active checkpoints.
6. Include an assignment final-deadline event only when the assignment is active and at least one checkpoint remains non-passed.
7. Omit passed checkpoint events and inactive-assignment events on subsequent refreshes.
8. Emit timed events using the authoritative UTC instant; the saved display timezone must not affect feed event instants.
9. Use stable deterministic UIDs for the same assignment/checkpoint event across refreshes.
10. Reflect due-date changes on later refreshes while retaining event identity.
11. Produce RFC 5545-compatible output with correct `text/calendar` metadata, CRLF line endings, safe line folding, escaped text values, valid UTC event timestamps, and no plaintext bearer credential in event content.

### FR-5: Security and operational safeguards

1. Apply route-appropriate rate limiting to credential-authenticated feed requests.
2. Redact credentials from logs, errors, analytics, and audit details.
3. Use safe cache and referrer headers so private calendar content is not publicly cached or leaked through referrers.
4. Enforce ownership and active-user checks server-side.
5. Keep the endpoint read-only; OAuth, calendar writes, synchronization callbacks, and two-way updates are excluded.

### FR-6: Accessibility and localization

1. Add bilingual English and Indonesian labels, help text, status messages, confirmations, errors, and empty/disabled states.
2. Use accessible controls with keyboard operation, visible focus, appropriate labels, and announcements for enable/regenerate/revoke/save outcomes.
3. Ensure the settings UI remains usable at mobile widths and in light/dark themes.

## Non-Functional Requirements

- Follow the project’s client-safe/server-only function split and 500-line file limit.
- Preserve settings through read-modify-write semantics and validate all client-crossing inputs with Zod.
- Use transaction-safe token lifecycle mutations and enforce the one-active-token invariant at the database level.
- Maintain server-rendering/client-hydration consistency for timezone detection.
- Keep all existing deadline, reminder, gating, grade-release, notification, and authorization behavior unchanged.
- Maintain unit, integration, E2E, accessibility, typecheck, lint, i18n, coverage, and build quality gates.

## Acceptance Criteria

- [ ] A student sees a deterministic placeholder before browser timezone detection and then sees deadline values in a valid detected or manually selected IANA timezone.
- [ ] Invalid or unavailable timezone detection falls back to UTC without hydration errors.
- [ ] Settings updates preserve unrelated JSONB settings.
- [ ] Only the defined student deadline surfaces use the preference; instructor/admin and non-deadline behavior is unchanged.
- [ ] Stored deadline values and reminder-scanner behavior remain UTC/instant based.
- [ ] A student can explicitly enable the feed, copy its subscription URL, regenerate it, and revoke it.
- [ ] Only one active token exists per student; regeneration invalidates the old token and revocation invalidates the current token.
- [ ] Plaintext credentials are never persisted or logged.
- [ ] The feed contains only the student’s non-passed checkpoint deadlines, including locked and overdue checkpoints, plus qualifying active-assignment final deadlines.
- [ ] Passed and inactive events disappear after refresh; changed deadlines update existing stable-UID events.
- [ ] Feed output remains valid across DST boundaries and RFC 5545 escaping/folding cases.
- [ ] Invalid credentials cannot disclose student or assignment existence.
- [ ] Credential lifecycle events are auditable without sensitive token data.
- [ ] All new UI is bilingual, accessible, responsive, and covered by the required automated tests and quality gates.

## Out of Scope

- Instructor/admin timezone preferences or timezone-aware non-student surfaces.
- Changing stored deadline values or deadline-reminder semantics.
- Google Calendar/Microsoft OAuth, calendar invitations, recurring events, or two-way calendar writes.
- Consultation booking, scheduled releases, or notification changes.
- Email-template localization changes.
- Student-facing calendar history or a replacement for the existing reminder scanner.
