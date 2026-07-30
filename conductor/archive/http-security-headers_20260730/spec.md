<protect>
# TRACK-041: HTTP Security Headers

## Track Information
- **Type:** Chore (Infrastructure / Security Hardening)
- **Milestone:** 12 (Security, Reliability & Real-Time Infrastructure)
- **Dependencies:** None
- **Audit IDs:** None (proactive hardening)

## Overview

SIMAK's `app.config.ts` currently emits zero HTTP security headers. Traefik handles TLS termination but no app-level security headers are set. This track implements comprehensive HTTP security headers with nonce-based Content Security Policy (CSP) to defend against XSS, clickjacking, MIME-sniffing, and other common web vulnerabilities.

CSP is the primary defense against stored XSS — the app has rich user-generated content (assignment descriptions, review feedback, discussion Q&A). Inline scripts (`__root.tsx` theme script for FOUC prevention, TanStack Router hydration scripts) require nonce-based CSP rather than naive `script-src 'self'`.

## Functional Requirements

### FR-1: Create `createStart` instance with CSP middleware
- Create `src/start.ts` with a `createStart` instance.
- Implement a global server middleware via `createMiddleware().server()` that:
  - Generates a cryptographic nonce per request using `crypto.randomBytes(16).toString('base64')`.
  - Sets all security headers via `setResponseHeader()` from `@tanstack/react-start/server`.
  - Passes the nonce to the router context for auto-attachment to `<script>`/`<style>` tags.
- Use `Content-Security-Policy-Report-Only` header in dev (violations logged, not blocked).
- Use `Content-Security-Policy` header in prod (enforced).

### FR-2: Configure nonce on router
- Update `src/router.tsx` to add `ssr: { nonce }` configuration so TanStack Start auto-attaches the nonce to all inline `<script>` and `<style>` tags.
- The nonce is received from the middleware via router context.

### FR-3: Content-Security-Policy directives
- `default-src 'self'`
- `script-src 'nonce-{nonce}' 'strict-dynamic'`
- `style-src 'nonce-{nonce}'`
- `img-src 'self' data: https:`
- `connect-src 'self' <R2_ENDPOINT domain>` (strict — no WebSocket pre-allowance; will be updated in TRACK-046)
- `frame-src 'self'`
- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `object-src 'none'`
- `upgrade-insecure-requests`

### FR-4: Additional security headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — **prod only** (skip in dev to avoid browser lockout on HTTP localhost)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### FR-5: R2 domain resolution for connect-src
- Extract the domain from `R2_ENDPOINT` env var (used by `src/lib/storage.ts` → `getR2Client()`).
- Include this domain in the `connect-src` directive.
- If `R2_ENDPOINT` is not set, omit the R2 domain gracefully (dev fallback).

### FR-6: Documentation
- Document CSP allowlist rationale, nonce lifecycle, and environment differences (Report-Only vs enforce) in `conductor/tech-stack.md`.

## Non-Functional Requirements

### NFR-1: Performance
- Nonce generation must use efficient crypto (`crypto.randomBytes`).
- Header setting must not add measurable latency to requests.

### NFR-2: File size
- `src/start.ts` must be under 500 lines (enforced by `check-modularity.js`).

### NFR-3: Backward compatibility
- All existing functionality must continue to work: Tailwind v4 styles, R2 presigned URL PUT/GET, Better Auth fetch calls, DOCX iframe preview, hydration scripts, theme script.

## Acceptance Criteria

1. All 6 security headers present on all HTTP responses (including API + auth routes):
   - Content-Security-Policy (or Content-Security-Policy-Report-Only in dev)
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security (prod only)
   - Referrer-Policy
   - Permissions-Policy
2. Nonce-based CSP allows framework scripts/styles via auto-attached nonces (no manual changes needed to `__root.tsx`).
3. `connect-src` includes the `R2_ENDPOINT` domain.
4. Report-Only mode in dev; enforced in prod.
5. HSTS present only in prod.
6. Unit tests cover: nonce generation (uniqueness, length, base64 format), header values (exact string match), Report-Only vs enforce switching.
7. E2E test asserts header presence + values on both authenticated and unauthenticated routes.
8. All existing E2E tests pass (no CSP breakage).
9. `src/start.ts` under 500 lines.
10. `pnpm typecheck` + `pnpm lint` + `pnpm test` all clean.

## Out of Scope

- Traefik-level header configuration (app-level only).
- Subresource Integrity (SRI) for external scripts (none used).
- CSP violation reporting endpoint (could be added in a future track).
- WebSocket/SSE `connect-src` allowances (deferred to TRACK-046).
- Expanding Permissions-Policy beyond geolocation, microphone, camera.
- Changes to `__root.tsx` (TanStack Start's nonce mechanism auto-attaches).
</protect>
