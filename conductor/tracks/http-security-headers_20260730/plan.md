# TRACK-041: Implementation Plan

## Phase 1: Research & API Verification

- [ ] Task: Verify TanStack Start nonce/middleware API
    - [ ] Load `tanstack-start-best-practices` skill and review nonce/middleware patterns
    - [ ] Verify `createStart`, `createMiddleware`, `setResponseHeader` exports exist in installed `@tanstack/react-start` version (check `node_modules/@tanstack/react-start/dist/`)
    - [ ] Review TanStack Start docs for nonce propagation from middleware to router context
    - [ ] Check `src/lib/storage.ts` for R2 endpoint domain extraction logic (`getR2Client()`)
    - [ ] Check `src/config/env.ts` for `R2_ENDPOINT` env var access pattern
    - [ ] Locate E2E test directory and existing E2E test patterns (Playwright config)
- [ ] Task: Conductor - User Manual Verification 'Research & API Verification' (Protocol in workflow.md)

## Phase 2: Security Headers Pure Logic (TDD)

- [ ] Task: Write Tests (Red) — `tests/unit/lib/security-headers.test.ts`
    - [ ] Test `generateNonce()` returns base64 string of correct length (24 chars from 16 bytes)
    - [ ] Test `generateNonce()` returns unique values across multiple calls
    - [ ] Test `buildSecurityHeaders(nonce, true, r2Domain)` returns prod headers with `Content-Security-Policy` key
    - [ ] Test `buildSecurityHeaders(nonce, false, r2Domain)` returns dev headers with `Content-Security-Policy-Report-Only` key
    - [ ] Test CSP value contains all directives: `default-src`, `script-src` with nonce + `'strict-dynamic'`, `style-src` with nonce, `img-src`, `connect-src`, `frame-src`, `frame-ancestors`, `base-uri`, `form-action`, `object-src`, `upgrade-insecure-requests`
    - [ ] Test `connect-src` includes R2 domain when provided
    - [ ] Test `connect-src` omits R2 domain gracefully when not provided (undefined/null)
    - [ ] Test `X-Frame-Options: DENY` present
    - [ ] Test `X-Content-Type-Options: nosniff` present
    - [ ] Test `Strict-Transport-Security` present only when `isProd=true`, absent when `isProd=false`
    - [ ] Test `Referrer-Policy: strict-origin-when-cross-origin` present
    - [ ] Test `Permissions-Policy: geolocation=(), microphone=(), camera=()` present
- [ ] Task: Implement (Green) — `src/lib/security-headers.ts`
    - [ ] Implement `generateNonce()`: `crypto.randomBytes(16).toString('base64')`
    - [ ] Implement `buildSecurityHeaders(nonce: string, isProd: boolean, r2Domain?: string): Record<string, string>`
    - [ ] Build CSP directive string with all directives, nonce substitution, and conditional R2 domain
    - [ ] Return header name/value map with `Content-Security-Policy` (prod) or `Content-Security-Policy-Report-Only` (dev)
    - [ ] Include HSTS only when `isProd=true`
- [ ] Task: Refactor
    - [ ] Review `src/lib/security-headers.ts` for clarity and file size
    - [ ] Ensure no duplication in CSP directive building
- [ ] Task: Conductor - User Manual Verification 'Security Headers Pure Logic' (Protocol in workflow.md)

## Phase 3: TanStack Start Integration

- [ ] Task: Create `src/start.ts` with `createStart` instance + CSP middleware
    - [ ] Import `createStart`, `createMiddleware` from `@tanstack/react-start`
    - [ ] Import `setResponseHeader` from `@tanstack/react-start/server`
    - [ ] Import `generateNonce`, `buildSecurityHeaders` from `@/lib/security-headers`
    - [ ] Import `env` from `@/config/env` for `R2_ENDPOINT` access
    - [ ] Implement `createMiddleware().server()` that: generates nonce, extracts R2 domain from `R2_ENDPOINT`, calls `buildSecurityHeaders()`, sets all headers via `setResponseHeader()`, passes nonce to router context
    - [ ] Export `createStart` instance with the middleware
- [ ] Task: Update `src/router.tsx` with nonce configuration
    - [ ] Add `ssr: { nonce }` to `createRouter()` options
    - [ ] Receive nonce from middleware context (per TanStack Start API verified in Phase 1)
- [ ] Task: Run `pnpm typecheck` to verify integration compiles
- [ ] Task: Run `pnpm test` to verify unit tests still pass
- [ ] Task: Conductor - User Manual Verification 'TanStack Start Integration' (Protocol in workflow.md)

## Phase 4: E2E Test

- [ ] Task: Write E2E test for security headers
    - [ ] Test header presence + values on unauthenticated route (e.g., `/auth/login`)
    - [ ] Test header presence + values on authenticated route (e.g., `/admin/dashboard` or `/instructor/dashboard`)
    - [ ] Assert all 6 security headers present with correct values
    - [ ] Assert CSP contains nonce (or Report-Only in dev)
- [ ] Task: Run all existing E2E tests to verify no CSP breakage
    - [ ] Verify Tailwind v4 styles render correctly (no `style-src` violations)
    - [ ] Verify R2 presigned URL flow works (no `connect-src` violations)
    - [ ] Verify Better Auth login flow works (no CSP violations)
    - [ ] Verify DOCX iframe preview works (no `frame-src` violations)
    - [ ] Verify hydration scripts load (no `script-src` violations)
- [ ] Task: Conductor - User Manual Verification 'E2E Test' (Protocol in workflow.md)

## Phase 5: Documentation & Final Verification

- [ ] Task: Update `conductor/tech-stack.md`
    - [ ] Add "HTTP Security Headers" section documenting CSP allowlist rationale
    - [ ] Document nonce lifecycle (generation → middleware → router context → auto-attach to scripts/styles)
    - [ ] Document environment differences (Report-Only in dev, enforce in prod, HSTS prod-only)
    - [ ] Add changelog entry
- [ ] Task: Run full verification suite
    - [ ] `pnpm typecheck`
    - [ ] `pnpm lint`
    - [ ] `pnpm test`
    - [ ] `pnpm test:coverage` (verify ≥80% thresholds for new code)
    - [ ] Verify `src/start.ts` + `src/lib/security-headers.ts` under 500 lines each (`node scripts/check-modularity.js`)
- [ ] Task: Conductor - User Manual Verification 'Documentation & Final Verification' (Protocol in workflow.md)
