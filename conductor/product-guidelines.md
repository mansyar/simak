<protect>
# Product Guidelines

## Writing Style & Tone

- **Professional yet approachable** — Use clear, direct language suitable for an academic environment
- **Bilingual by default** — Every user-facing string must support English (en) and Indonesian (id). UI text must use translation keys (`t('key')`) — no hardcoded strings
- **Consistent terminology** — Use the following terms consistently across both languages:
  - Assignment / Tugas
  - Checkpoint / Tahapan
  - Submission / Pengumpulan
  - Review / Peninjauan
  - Consultation / Bimbingan
  - Template / Templat

## UX Principles

- **Progressive disclosure** — Present information in stages. Students see only what's relevant at their current checkpoint state
- **Sequential clarity** — The checkpoint timeline must clearly show:
  1. Which checkpoint is active
  2. What's blocking locked checkpoints
  3. Past decisions and feedback
- **Role-appropriate views** — Each role sees a tailored interface. An instructor should never see student-only actions, and vice versa
- **Feedback immediacy** — All actions (submit, review, verify) must show immediate confirmation with inline notifications
- **Forgiving design** — Destructive actions require confirmation. Form submissions preserve input on validation errors

## Visual & Brand Guidelines

- **Theme support** — Full light and dark mode. Use Tailwind `dark:` variants and CSS custom properties exclusively
- **Semantic color system:**
  - Success (Pass) — Green tones
  - Warning (Revise) — Amber/Orange tones
  - Error (Overdue, Missed) — Red tones
  - Info (Consultation) — Blue tones
- **Responsive** — All pages functional at 320px–1920px viewport widths. Touch-friendly targets (min 44px)
- **Accessibility (WCAG 2.1 AA):**
  - Keyboard navigation for all interactive elements
  - Visible focus indicators
  - ARIA labels on all interactive elements
  - Screen reader announcements for dynamic content via `aria-live` regions
  - Skip-to-content link as first focusable element
  - Color contrast ratios meeting WCAG 2.1 AA minimum
- **shadcn/ui primitives** — Use Radix UI-based components for all interactive elements (dialogs, selects, dropdowns, etc.)

## Error & Empty State Guidelines

- **Validation errors** — Display inline below the relevant field, not in a banner at the top
- **Authorization errors** — Redirect to the appropriate dashboard with a toast message
- **Not found (404)** — Show a dedicated 404 page with a link back to the dashboard
- **Empty states** — Every list view must show a helpful empty state (e.g., "No assignments yet") with a clear next action
- **Loading states** — Use skeleton screens for data lists and checkpoints; use spinners for single actions

## Notification Behavior

- **In-app notifications** are the primary channel (v1); email is v2 (except invitation emails)
- **Differentiated polling intervals** based on priority:
  - High (submissions, reviews): 10s when active, 60s in background
  - Medium (deadlines): 30s active, 120s background
  - Low (consultations): 60s active, 300s background
- **Unread count badge** on the sidebar bell icon
- **Mark as read** on click; "Mark all as read" option in the notification center

## Data Integrity Guidelines

- **Immutable audit trail** — Submissions are append-only. Each resubmission creates a new row with an incremented version number; nothing is ever deleted
- **Soft deletes** — Users, templates, and assignments use `deletedAt` for soft deletion
- **Sequential enforcement** — Checkpoint state transitions must be validated server-side; client-side checks are supplementary
- **File isolation** — Presigned URLs enforce ownership via userId and role checks
- **All server functions** validate session + role before executing
  </protect>
