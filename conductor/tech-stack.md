<protect>
# Technology Stack

## Core Framework

| Component        | Technology                  | Purpose                                                                                            |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Framework**    | TanStack Start (Vite + SSR) | Full-stack React meta-framework with type-safe routing, server functions, and fast Vite dev server |
| **Routing**      | TanStack Router             | File-based routing with type-safe params and search params; Zod integration for runtime validation |
| **Server State** | TanStack Query              | Caching, deduplication, background refetching, polling for notifications                           |
| **Rendering**    | SSR + Client hydration      | Dashboard SSR for initial data; interactive pages client-rendered                                  |

## Frontend

| Component      | Technology            | Purpose                                                         |
| -------------- | --------------------- | --------------------------------------------------------------- |
| **UI Library** | shadcn/ui (Radix UI)  | Accessible, composable components with built-in ARIA compliance |
| **Styling**    | Tailwind CSS v4       | Utility-first CSS with design system integration                |
| **Forms**      | React Hook Form + Zod | Performant forms with Zod validation resolver                   |
| **i18n**       | typesafe-i18n         | Type-safe translations with compile-time checks                 |
| **Client-Side XLSX** | SheetJS (`xlsx`) | Client-side .xlsx parsing, sample-file generation, and dashboard data export |
| **DOCX Preview**     | mammoth.js           | `.docx` → HTML conversion, ~30KB gzipped, lazy-loaded via dynamic `import()` |

## Backend & Data

| Component           | Technology             | Purpose                                                                       |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| **Database**        | PostgreSQL             | Relational data model with strong integrity constraints                       |
| **Database Driver** | postgres (postgres.js) | Native ESM PostgreSQL driver, lightweight, recommended by Drizzle             |
| **ORM**             | Drizzle ORM            | Type-safe SQL-first ORM, lightweight, no code generation                      |
| **Validation**      | Zod                    | Runtime schema validation for forms and API inputs                            |
| **Authentication**  | Better-Auth            | Framework-agnostic auth with email/password, session management, role support |

## Infrastructure

| Component            | Technology     | Purpose                                                    |
| -------------------- | -------------- | ---------------------------------------------------------- |
| **File Storage**     | Cloudflare R2  | S3-compatible object storage with presigned URL uploads    |
| **Email**            | Resend         | Transactional email API for invitations and password setup |
| **Package Manager**  | pnpm           | Fast, disk-efficient package management                    |
| **Containerization** | Docker         | Multi-stage build for production deployment                |
| **Hosting**          | Coolify on VPS | Self-hosted deployment with auto-proxied SSL via Traefik   |

## Security

### HTTP Security Headers (TRACK-041)

Comprehensive HTTP security headers are set per-request via TanStack Start middleware in `src/start.ts`. The nonce-based Content Security Policy (CSP) is the primary defense against stored XSS — the app has rich user-generated content (assignment descriptions, review feedback, discussion Q&A).

**Implementation files:**
- `src/lib/security-headers.ts` — `generateNonce()` + `buildSecurityHeaders(nonce, isProd, r2Domain?)` pure functions
- `src/start.ts` — `createStart` instance with `securityHeadersMiddleware` (request middleware) + `createCsrfMiddleware`
- `src/router.tsx` — `getGlobalStartContext()` nonce extraction + `ssr: { nonce }` router option

**Nonce lifecycle:**
1. `securityHeadersMiddleware` runs on every request via `createMiddleware().server()`
2. `generateNonce()` generates 16 random bytes → base64 (24-char string)
3. Nonce is embedded in CSP directives (`script-src 'nonce-{nonce}'`, `style-src 'nonce-{nonce}'`)
4. Nonce is passed to router context via `next({ context: { nonce } })`
5. `getGlobalStartContext()` in `src/router.tsx` reads the nonce from context
6. `ssr: { nonce }` on `createRouter()` — TanStack Start auto-attaches the nonce to all inline `<script>` and `<style>` tags during SSR

**CSP directive rationale:**

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self'` | Deny everything by default; each resource type must be explicitly allowed |
| `script-src` | `'nonce-{nonce}' 'strict-dynamic'` | Allow only nonce-tagged inline scripts (hydration, theme script). `'strict-dynamic'` trusts scripts loaded by other trusted scripts, avoiding the need to allowlist every dynamic import |
| `style-src` | `'nonce-{nonce}'` | Allow only nonce-tagged inline styles (Tailwind v4 injects styles at runtime) |
| `img-src` | `'self' data: https:` | Allow self-hosted images, `data:` URIs (inline images), and any HTTPS image source |
| `connect-src` | `'self' <R2_ENDPOINT domain>` | Allow same-origin fetch/XHR + R2 presigned URL requests. R2 domain extracted from `R2_ENDPOINT` env var; omitted gracefully if unset. WebSocket/SSE allowances deferred to TRACK-046 |
| `frame-src` | `'self'` | Allow only same-origin iframes (DOCX preview uses iframe) |
| `frame-ancestors` | `'none'` | Prevent the page from being embedded in any iframe (clickjacking defense; supersedes `X-Frame-Options`) |
| `base-uri` | `'self'` | Prevent `<base>` tag injection attacks |
| `form-action` | `'self'` | Restrict form submissions to same-origin only |
| `object-src` | `'none'` | Block all `<object>`, `<embed>`, `<applet>` (legacy plugin vectors) |
| `upgrade-insecure-requests` | _(prod only)_ | Force browser to upgrade HTTP to HTTPS. Omitted in dev (Report-Only mode has no effect and Chrome logs a console error) |

**Environment differences:**

| Aspect | Development | Production |
|--------|-------------|------------|
| CSP header name | `Content-Security-Policy-Report-Only` | `Content-Security-Policy` |
| CSP behavior | Violations logged to console, not blocked | Violations blocked |
| `Strict-Transport-Security` (HSTS) | Absent (avoids browser lockout on HTTP localhost) | `max-age=31536000; includeSubDomains` |
| `upgrade-insecure-requests` | Omitted (no effect in Report-Only mode) | Included |

**CSRF middleware:**
When a custom `src/start.ts` exists, TanStack Start does NOT auto-install CSRF middleware. `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })` is explicitly added to the `requestMiddleware` array, matching TanStack Start's default behavior (CSRF validation only on server function POST requests, not GET page navigations).

### Application-Level Rate Limiting (TRACK-043)

Rate limiting is enforced at the `typedServerFn` layer — the single entry point for all authenticated server functions. Better Auth's built-in rate limiting only covers `/api/auth/*` endpoints; this track extends protection to all application server functions (assignments, submissions, reviews, file uploads, etc.).

**Implementation files:**
- `src/lib/rate-limiter.ts` — `RATE_LIMITS` presets, `checkRateLimit()` sliding window logic, `createRateLimitMiddleware()` middleware factory, module-level `rateLimitStore` Map
- `src/lib/server-fn.ts` — `typedServerFn()` accepts optional `rateLimit?: RateLimitConfig`; chains `createRateLimitMiddleware()` via `.middleware()` when provided; pass-through when omitted
- `src/lib/errors.ts` — `RATE_LIMITED` error code added to `ErrorCode` enum
- `src/lib/toast.ts` — `RATE_LIMITED` mapped to `error.rateLimited` i18n key

**Rate limit tiers:**

| Tier | Preset | Limit | Use Case | Example Functions |
|------|--------|-------|----------|-------------------|
| 1 | `RATE_LIMITS.presignedUrl` | 20/min | R2 presigned URL generation (cost abuse prevention) | `getPresignedUploadUrl`, `getPresignedDownloadUrl`, `getPresignedAvatarUploadUrl` |
| 2 | `RATE_LIMITS.heavyMutation` | 10/min | High-impact mutations (submissions, reviews) | `submitCheckpoint`, `submitReview`, `openForReview` |
| 3 | `RATE_LIMITS.destructive` | 5/min | Destructive or admin-level operations | `createAssignment`, `deleteTemplate`, `createUser`, `extendDeadline`, `approveExtension`, `enableTwoFactor` |
| 4 | `RATE_LIMITS.standardRead` | 60/min | Standard read queries (dashboards, lists, detail views) | `listUsers`, `getAssignmentDetail`, `getStudentDashboardData`, `listAuditLogs` |

**Sliding window algorithm:**
Each `(userId, fnId)` pair has an independent entry in the in-memory `Map`. The window resets when the configured `window` time (in ms) elapses since first request. Requests under `max` increment the counter and are allowed. Requests at or above `max` are denied without incrementing (preventing permanent lockout after window expiry).

**Exempt functions (no rateLimit):**
- `auth.ts`: `_getSession` — internal helper, cascading/infinite-loop concern
- `notifications.ts`: `getUnreadCount`, `markRead`, `markAllRead` — high-frequency UX (30s polling)
- `setup-password.ts`: `completePasswordSetup` — token-based, no session required

**Per-user + per-function isolation:**
The rate limit key is `userId + ':' + fnId`, where `fnId` is an auto-incrementing counter assigned per middleware instance. This means a user hitting `listUsers` 60 times in a minute does NOT affect their ability to call `getAssignmentDetail` — each function has its own independent counter.

**Unauthenticated pass-through:**
`createRateLimitMiddleware()` calls `getSessionFromHeaders()`. If no session is found, the middleware passes through to `next()` without rate limiting. Unauthenticated requests are rejected by route guards before reaching protected server functions.

**Error handling:**
When a rate limit is exceeded, the middleware short-circuits with `serverError(RATE_LIMITED, 'Rate limit exceeded')`. The client-side toast system maps this to the `error.rateLimited` i18n key: "Too many requests. Please wait a moment and try again." (EN) / "Terlalu banyak permintaan. Mohon tunggu sebentar dan coba lagi." (ID).

**Single-instance scope:**
The in-memory `Map` store is sufficient for the current single-instance Coolify deployment. Multi-instance support (Redis-backed store) is deferred to a future track.

**`.middleware()` method on `TypedBuilder`:**
The `.middleware(middlewares: unknown[]): TypedBuilder` method was added to the `TypedBuilder` interface in `src/lib/server-fn.ts`. This is shared infrastructure — TRACK-044 (request-scoped context) also uses `.middleware()` to inject request context into server functions.

## Testing & Quality

| Component                  | Technology                           | Purpose                                                 |
| -------------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Unit/Integration Tests** | Vitest                               | Fast unit and integration tests with coverage reporting |
| **E2E Tests**              | Playwright                           | End-to-end browser tests (chromium + firefox + mobile) |
| **Accessibility Scanning** | @axe-core/playwright                 | Automated WCAG 2.1 AA accessibility audits in E2E tests |
| **Code Quality**           | oxlint + oxfmt + Lefthook            | Pre-commit linting/formatting/modularity; pre-push typecheck & coverage |

## Version Requirements

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16
- Docker (for local dev and production build)

## Changelog

- **2026-07-22:** Added `mammoth.js` for client-side `.docx` → HTML conversion on the instructor review detail page. Lazy-loaded via dynamic `import('mammoth')` to keep it out of the main client bundle. Used in `ReviewFilePreview` component (TRACK-017).
- **2026-07-22:** **Deviation from plan** — The plan (Phase 0) specified `@radix-ui/react-popover` for the keyboard cheat-sheet Popover component. However, the entire codebase uses `@base-ui/react` for all UI primitives (Dialog, Sheet, etc.). `@base-ui/react/popover` is already installed and available. Replaced `@radix-ui/react-popover` with `@base-ui/react/popover` for consistency. Uninstalled `@radix-ui/react-popover` (was installed in Phase 0 commit `784fcd3`).
- **2026-07-23:** Upgraded TypeScript from 5.8 to 7.0 (native Go compiler port). Removed `baseUrl: "."` from `tsconfig.json` (option removed in TS 7; `paths` mapping is already relative). Added `--checkers` flag to the pre-push typecheck gate in `lefthook.yml` to leverage TS 7's shared-memory multithreading. No source code changes required (zero Compiler API consumers, no blocked frameworks).
- **2026-07-27:** Added `@axe-core/playwright` for automated accessibility scanning in E2E tests. Added Firefox and mobile-chrome (Pixel 7) projects to Playwright config. Fixed 8 critical/serious WCAG violations (color contrast, aria-labels, button names) across 10 source files (TRACK-028).
- **2026-07-28:** Aligned `lefthook.yml` and `package.json` tooling gates (TRACK-036, INFRA-10). `pnpm format` expanded from `src/**/*.{ts,tsx,css}` to `*.{js,jsx,ts,tsx,css}` (all dirs); lefthook format glob added `.css`; lefthook lint glob expanded from `src/**/*.{js,jsx,ts,tsx}` to `*.{js,jsx,ts,tsx}` (all dirs); `pnpm typecheck` added `--checkers 4` (was only in lefthook pre-push gate). Created `.socraticodecontextartifacts.json` with 7 entries for SocratiCode semantic search across project docs and DB migrations.
- **2026-07-29:** Added `pino` (production dependency) and `pino-pretty` (devDependency) for structured logging (TRACK-040). New `src/lib/logger.ts` — singleton pino instance with env-based config (`LOG_LEVEL` env var, default `info`). Production: JSON to stdout. Dev: `pino-pretty` (lazy-loaded via `createRequire` to avoid bundling in prod). New `src/lib/request-context.ts` — TanStack Start `createMiddleware({ type: 'request' })` for request ID propagation (`x-request-id` header → UUID → `logger.child({ requestId })`). `logError()` in `src/lib/errors.ts` refactored to route through `logger.error(entry)` instead of `console.error`. All 41 `console.*` calls in `src/lib/` and `src/server/` migrated to pino (zero `console.*` remaining, excluding `src/db/seed.ts` and `src/db/migrate.ts`).
- **2026-07-30:** Added HTTP security headers with nonce-based CSP (TRACK-041). New `src/lib/security-headers.ts` (`generateNonce()` + `buildSecurityHeaders()`), `src/start.ts` (`createStart` instance with `securityHeadersMiddleware` + `createCsrfMiddleware`). Updated `src/router.tsx` with `getGlobalStartContext()` nonce extraction + `ssr: { nonce }`. CSP directives enforce strict defaults (`default-src 'self'`, `script-src 'nonce-{nonce}' 'strict-dynamic'`, `object-src 'none'`, etc.). Report-Only in dev, enforced in prod. HSTS and `upgrade-insecure-requests` prod-only. R2 domain auto-extracted from `R2_ENDPOINT` for `connect-src`.
- **2026-07-30:** Configured explicit connection pool settings on postgres.js client in `src/db/index.ts` (TRACK-042). Migrated `getDb()` to use `getEnv()` instead of `process.env.DATABASE_URL` (removes manual guard — Zod validation handles it). Pool config: `max`=`DB_POOL_MAX` (default 10, suitable for single-instance Coolify), `idle_timeout`=30s, `connect_timeout`=10s, `max_lifetime`=1800s (30 min). `prepare` flag controlled by `DB_PREPARED_STATEMENTS_DISABLED` env var (set to `true` for PgBouncer transaction pooling compatibility). `onnotice` callback routes PostgreSQL notices through pino at debug level. New env vars: `DB_POOL_MAX` (`z.coerce.number().int().positive().default(10)`), `DB_PREPARED_STATEMENTS_DISABLED` (custom string-to-boolean transform — `val === 'true'`, default `false`; NOT `z.coerce.boolean()` which returns `true` for the string `'false'`). **Deviation from spec (FR-3):** `prepare` was NOT added to the `drizzle()` call because drizzle-orm 0.45.2's `DrizzleConfig` type does not include a `prepare` property. The `prepare` option on the postgres.js client (FR-2) is sufficient — Drizzle uses the underlying client's settings.
- **2026-07-30:** Added application-level rate limiting on all authenticated TanStack Start server functions via `typedServerFn` `rateLimit` config (TRACK-043). New `src/lib/rate-limiter.ts` — in-memory sliding window with 4-tier `RATE_LIMITS` presets (`presignedUrl` 20/min, `heavyMutation` 10/min, `destructive` 5/min, `standardRead` 60/min). Per-user + per-function isolation (`userId:fnId` key). Unauthenticated pass-through. `RATE_LIMITED` error code added to `src/lib/errors.ts`; mapped to `error.rateLimited` i18n key in `src/lib/toast.ts` (EN/ID). `.middleware()` method added to `TypedBuilder` interface in `src/lib/server-fn.ts` (shared with TRACK-044). 85 server functions annotated across 22 stub files. Exempt: `_getSession`, `getUnreadCount`/`markRead`/`markAllRead` (high-freq UX), `completePasswordSetup` (token-based). Single-instance in-memory `Map` — Redis deferred for multi-instance.
- **2026-07-30:** Wired request ID middleware to every server function (TRACK-044). `src/lib/request-context-store.ts` provides standalone `AsyncLocalStorage<{ requestId: string }>` storage, avoiding a logger/request-context import cycle. `requestIdMiddleware` forwards the supplied `x-request-id` (or generates a UUID) through both TanStack context and AsyncLocalStorage; `createLogger()` uses a pino `mixin` for automatic request-ID enrichment without handler changes. The middleware runs before rate limiting so rate-limit logs are correlated. `createRequestLogger()` and explicit background-job child loggers remain supported outside request contexts.

</protect>
