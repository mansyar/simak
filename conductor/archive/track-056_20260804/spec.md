<protect>

# TRACK-056 — Search Bar Performance

## Overview

Search interactions across the application are visibly laggy because several inputs issue route or server updates on every keystroke, while other inputs repeatedly filter and render sizeable in-memory result sets. The settled server searches also perform expensive substring scans and unnecessary enrichment work.

This is a **bug/performance remediation track**. It covers all search surfaces identified by the audit, preserves the current case-insensitive contains-search behavior, and improves responsiveness through coordinated client, server, and database changes.

## Audit Findings Addressed

| Area | Current problem |
| --- | --- |
| Admin users, templates, email queue, and audit log | URL/server-backed search updates are either immediate or only partially debounced; settled searches perform multiple database queries. |
| Instructor and student assignments | A 300 ms debounce exists, but each settled search still performs data/count queries and result enrichment. |
| Feedback snippet list and picker | Raw search is part of the query key, causing a request on every keystroke; results are unpaginated. |
| Student and template pickers | Local filtering normalizes and renders bounded but relatively large card collections on every keystroke. |
| Search handlers | Most contains searches use leading-wildcard `ILIKE`/`LIKE` predicates without supporting trigram or full-text indexes. |

## Functional Requirements

### FR-1: Consistent remote-search interaction

- All URL/server-backed search inputs must update their visible input value immediately through local state.
- Route navigation or server-query state changes must be debounced by **300 ms** after the last keystroke.
- The standard must apply to admin users, templates, email queue, and audit log; instructor and student assignments; and the feedback snippet list and picker.
- Clearing a search must clear the visible value and result state immediately, without waiting for the debounce delay.
- Older in-flight or delayed results must not overwrite results for a newer search value.
- Existing page-reset behavior (search changes reset pagination to page 1) must be preserved.

### FR-2: Stable result presentation during search

- Existing results must remain visible while a new settled search is loading where the framework supports retaining previous data.
- Search transitions must not cause avoidable input flicker or discard the current result set before replacement data is available.
- Loading, empty, and error states must remain accessible and semantically correct.

### FR-3: Efficient server query workloads

- Preserve the existing case-insensitive contains-search semantics for supported fields.
- Feedback snippet list and picker responses must be bounded by pagination or an explicit result limit; list/picker responses must not return unnecessary full snippet bodies when they are not displayed.
- Template search must not repeat unrelated type/filter queries or sequential checkpoint enrichment work for every keystroke. Required template/checkpoint data must be fetched in the minimum necessary query phases while preserving the existing result shape.
- Email queue status summaries must not be recomputed as search-specific work when the summary is independent of the search term; use a stable query/cache boundary or equivalent separation.
- Assignment and user searches must retain their existing authorization, filters, ordering, pagination, and enrichment semantics while avoiding redundant fetch layers for the same search state.

### FR-4: Search-supporting PostgreSQL indexes

- Enable the PostgreSQL `pg_trgm` extension through a tracked, reversible database migration.
- Add appropriate trigram indexes for the searched text columns used by users, assignment templates, email queue, assignments, and feedback snippets.
- Add appropriate trigram support for audit-log `entityId` and the searched text representation of audit-log `details`.
- Explicitly cast JSONB audit details to text, or search targeted JSON fields, so the predicate and its supporting index are type-correct.
- Verify representative search plans use the new indexes rather than sequential scans at realistic table sizes.
- Do not change matching semantics to prefix-only or full-text search as part of this track.

### FR-5: Efficient local picker filtering

- StudentPicker and TemplatePicker must continue filtering locally without a server request per keystroke.
- Avoid repeated normalization of the same names/emails/types during each render.
- Avoid avoidable repeated selection-membership scans while preserving current selection, select-all, result caps, and card presentation behavior.
- Preserve the current maximum fetched result sizes unless a smaller explicit UI result limit is required to maintain responsiveness.

### FR-6: Tests and regression coverage

- Add or update unit/component tests for immediate input updates, 300 ms debounce behavior, immediate clearing, pagination reset, and stale-result protection across the shared search patterns.
- Add coverage for feedback snippet result limits/body projection, template/email queue search workload separation, and audit JSONB search behavior.
- Add migration/schema verification for the `pg_trgm` extension and required indexes.
- Include a repeatable query-plan verification procedure for representative searches in a configured PostgreSQL environment.
- Preserve existing search results, filters, authorization, ordering, pagination, and empty/error states.

## Non-Functional Requirements

- **NFR-1 (Responsiveness):** Rapid typing must not trigger one route navigation or server request per character, and the visible input must remain responsive.
- **NFR-2 (Database performance):** Representative non-empty searches must use the intended trigram indexes; no new unbounded feedback-snippet search response is permitted.
- **NFR-3 (Correctness):** Search semantics and result data must remain equivalent except for explicitly bounded feedback-snippet payloads and removal of unnecessary work.
- **NFR-4 (TDD):** Follow `conductor/workflow.md`: write failing tests before implementation, then run the focused tests before broader quality gates.
- **NFR-5 (Compatibility):** No new runtime dependency is required beyond the PostgreSQL extension; use the existing debounce and query patterns where practical.
- **NFR-6 (Accessibility/i18n):** Do not remove labels, keyboard behavior, focus behavior, loading announcements, or existing i18n coverage. No new user-facing strings should be hardcoded.
- **NFR-7 (Modularity):** Keep all files under the repository’s 500-line limit and follow existing server-function split conventions.

## Acceptance Criteria

- [ ] Rapidly typing a multi-character term in every remote search surface updates the visible input immediately and produces one debounced route/query update after 300 ms of inactivity, rather than one update per character.
- [ ] Clearing each remote search clears the input and resets the result page immediately.
- [ ] A stale response for an older search term cannot replace results for the latest term.
- [ ] Previous results remain available during settled-search loading where supported, without input flicker.
- [ ] StudentPicker and TemplatePicker issue no per-keystroke server request and avoid repeated normalization/membership work while preserving selection behavior.
- [ ] Feedback snippet list and picker responses are bounded and do not include unused full bodies in picker/list payloads.
- [ ] Template search no longer repeats unrelated filter queries or unnecessary sequential enrichment for every settled search.
- [ ] Email queue search does not recompute its independent status summary for every search term.
- [ ] Audit-log JSONB search is type-correct and covered by a non-empty-search test.
- [ ] `pg_trgm` is enabled by migration and representative plans demonstrate index-backed search for each indexed search family.
- [ ] Existing search result semantics, filters, authorization, ordering, pagination, and empty/error states remain intact.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, i18n checks, and modularity checks pass.

## Out of Scope

- Changing search semantics to prefix-only or full-text relevance ranking.
- Introducing Redis, a general-purpose application cache, or a new search service.
- Reworking unrelated form, date, code, or non-search inputs.
- Redesigning search result cards or changing business rules, authorization, filters, or sort order.
- Establishing hard browser FPS/latency targets; this track uses behavior and query-plan verification instead.

</protect>
