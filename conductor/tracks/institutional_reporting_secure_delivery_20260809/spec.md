# TRACK-061: Institutional Reporting & Secure Delivery

## Overview

Add secure, on-demand PDF reporting using SIMAK's existing analytics, academic-context, and official academic-record foundations.

Reports are generated from authoritative, role-scoped data, stored privately in Cloudflare R2, and made available through short-lived authorized download links. Scheduled and recurring generation are deferred.

## Functional Requirements

### 1. Allowlisted report catalog

The first release supports exactly:

1. **Institutional Academic Summary**
   - Available to Admin and SuperAdmin.
   - Supports term, course, section, and cohort filters.
   - Uses authoritative academic-context and released academic-record data.
2. **Official Transcript**
   - Students may generate only their own transcript.
   - Authorized administrators may generate a student transcript.
   - Uses immutable released transcript/GPA records, not mutable gradebook data.
3. **Analytics Summary**
   - Administrators access institutionally authorized analytics.
   - Instructors access only their assigned courses and sections.
   - Reuses established analytics calculations where applicable.

The feature must not accept arbitrary queries, templates, fields, or SQL.

### 2. Role-scoped access

- Every catalog listing, generation request, status read, and download must enforce server-side authorization.
- Users must not infer the existence or status of unauthorized report jobs.
- Download authorization must be checked when requesting the URL, not only when generating the report.
- Expired, deleted, or unauthorized artifacts must not receive presigned URLs.

### 3. Report parameters

Supported filters:

- Academic term
- Course
- Section
- Cohort

The application must:

- Validate filter combinations server-side.
- Restrict available values according to the requesting role.
- Reject references to unauthorized or nonexistent academic entities.
- Record normalized parameters with each report job for auditability.

Course sections carry optional, explicit cohort metadata. Cohort filtering uses this field only; it must not infer cohort identity from section codes or names. This small academic-context extension was approved during Phase 3 after confirming that the existing schema had no authoritative cohort representation.

### 4. On-demand generation

- Users manually request report generation.
- Generation is represented by a durable database job.
- Jobs expose bounded states: `pending`, `processing`, `completed`, `failed`, and `expired`.
- Repeated requests must not accidentally produce conflicting job transitions.
- Failures must be visible to the requester without exposing sensitive internals.
- Failed jobs may support an explicitly authorized manual retry.
- No recurring scheduler or cron worker is introduced.

### 5. PDF rendering

- PDFs are rendered server-side.
- The implementation plan must include a compatibility evaluation before selecting a renderer.
- Reports must support English and Indonesian.
- Output must provide:
  - Clear institutional identity and report title
  - Generation timestamp
  - Applied filter summary
  - Page numbering where appropriate
  - Accessible information hierarchy
  - Stable table layout for multi-page reports
- User-controlled values must be safely escaped.

### 6. Private artifact storage

- Generated PDFs are stored in private Cloudflare R2 storage.
- Object keys must not expose unnecessary personal information.
- The database records artifact metadata, ownership, expiry, and generation status.
- Downloads use short-lived presigned URLs issued only after authorization.
- Reports expire 30 days after successful generation.
- Expired artifacts must become unavailable even if physical cleanup has not yet completed.
- Cleanup must safely remove expired R2 objects and update durable state.

### 7. User interface

Provide bilingual, responsive, accessible controls for:

- Browsing reports available to the current role
- Selecting authorized filters
- Requesting generation
- Viewing job status
- Downloading completed reports
- Retrying eligible failures
- Understanding expiry dates and generation errors

UI must follow existing shadcn/Tailwind patterns and WCAG 2.1 AA expectations.

### 8. Audit and observability

Audit security-relevant events, including:

- Report requested
- Report generated
- Report generation failed
- Report downloaded
- Report retried
- Report expired or cleaned up

Structured logs must include report job and request identifiers while excluding report contents and unnecessary personal data.

## Non-Functional Requirements

- Follow the client-safe stub and server-only handler split.
- Use `typedServerFn`; never call `createServerFn` directly.
- Keep every source and test file within the 500-line modularity limit.
- Follow TDD with unit tests preceding implementation.
- Add integration coverage for job transitions, authorization, official-record sourcing, and cleanup.
- Maintain at least 80% project coverage.
- Generation must not hold a database transaction open during PDF rendering or R2 network operations.
- Job transitions must be concurrency-safe.
- All visible strings must use bilingual i18n keys.
- Report generation must work in the existing Docker/Coolify runtime.

## Acceptance Criteria

- Each role sees only reports and filters it is authorized to use.
- Admins can generate a filtered institutional academic summary.
- Instructors can generate analytics only for their courses and sections.
- Students can generate only their own official transcript.
- Transcript PDFs use released academic records rather than mutable gradebook data.
- Successful jobs produce private R2 artifacts and authorized short-lived downloads.
- Unauthorized users cannot inspect jobs or obtain download URLs.
- PDF content supports English and Indonesian.
- Failed jobs expose a safe user-facing error and eligible retry path.
- Reports become inaccessible 30 days after generation.
- Cleanup handles expired artifacts idempotently.
- Generation, download, failure, retry, and expiry events are auditable.
- Unit, integration, type, lint, i18n, and coverage gates pass.

## Out of Scope

- Recurring or scheduled reports
- Cron or durable scheduling infrastructure
- Email attachments or scheduled email delivery
- Saved report parameter presets
- Arbitrary report designers
- Arbitrary SQL or custom field selection
- Editing official transcript data
- Generating transcripts from unreleased grades
- Public or permanent report URLs
- Reports beyond the three allowlisted templates
