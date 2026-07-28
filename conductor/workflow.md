<protect>
# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` _before_ implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** ≥80% on lines, statements, branches, **and** functions (enforced by `vitest.config.ts` thresholds)
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & Single-Run:** Prefer non-interactive commands. `pnpm test` runs `vitest run` (single execution, not watch). Use `pnpm test:watch` only during active development, never in checkpoints or CI.

## AI Agent Behavioral Guidelines

When an AI agent (such as Claude, Cursor, Roo, or Conductor itself) is executing tasks in this repository, it MUST adhere to the following code of conduct:

**1. Think Before Coding**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**2. Simplicity First**

- Write the minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**3. Surgical Changes**

- Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken. Match existing style.
- Remove imports/variables/functions that YOUR changes made unused, but don't delete pre-existing dead code unless asked.

**4. Goal-Driven Execution**

- Define success criteria and loop until verified.
- Transform tasks into verifiable goals (e.g., "Fix the bug" → "Write a test that reproduces it, then make it pass").
- For multi-step tasks, state a brief plan and verify each step.

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file under `tests/unit/` mirroring the `src/` path of the feature.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **CRITICAL:** Run `pnpm test` and confirm the new tests fail as expected. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run `pnpm test` again and confirm all tests now pass.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor implementation and test code to improve clarity, remove duplication, and enhance performance without changing external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Verify Coverage & Quality Gates:** Run the full quality gate suite (see **Quality Gates** below):

   ```bash
   pnpm test:coverage   # vitest run --coverage; thresholds: lines/stmts/branches/funcs ≥80%
   pnpm typecheck       # tsc --noEmit --incremental --checkers 4
   pnpm lint            # oxlint . (includes simak-i18n/no-hardcoded rule)
   pnpm check:i18n      # i18n key parity EN↔ID
   ```

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes:**
   - Stage all code changes related to the task.
   - Propose a clear, concise commit message e.g, `feat(ui): Create basic HTML structure for calculator`.
   - Perform the commit. The Lefthook pre-commit hook will run `oxlint --fix` → `oxfmt --write` → `check-modularity.js` on staged files.

9. **Attach Task Summary with Git Notes:**
   - **Step 9.1: Get Commit Hash:** Obtain the hash of the _just-completed commit_ (`git log -1 --format="%H"`).
   - **Step 9.2: Draft Note Content:** Create a detailed summary for the completed task. This should include the task name, a summary of changes, a list of all created/modified files, and the core "why" for the change.
   - **Step 9.3: Attach Note:** Use the `git notes` command to attach the summary to the commit.
      ```bash
      # The note content from the previous step is passed via the -m flag.
      git notes add -m "<note content>" <commit_hash>
      ```

10. **Get and Record Task Commit SHA:**
    - **Step 10.1: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the first 7 characters of the _just-completed commit's_ commit hash.
    - **Step 10.2: Write Plan:** Write the updated content back to `plan.md`.

11. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message (e.g., `conductor(plan): Mark task 'Create user model' as complete`).

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Ensure Test Coverage for Phase Changes:**
    - **Step 2.1: Determine Phase Scope:** To identify the files changed in this phase, you must first find the starting point. Read `plan.md` to find the Git commit SHA of the _previous_ phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    - **Step 2.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD` to get a precise list of all files modified during this phase.
    - **Step 2.3: Verify and Create Tests:** For each file in the list:
      - First, check its extension. Exclude non-code files (e.g., `.md`, `.yaml`, `*.gen.ts`).
      - **Note on `.json`:** `locales/en.json` and `locales/id.json` are i18n source-of-truth — exclude them from "needs a unit test" but DO verify `pnpm check:i18n` passes. Other `.json` (e.g., package config) can be excluded.
      - For each remaining code file, verify a corresponding test file exists under `tests/unit/` (mirroring the `src/` path).
      - If a test file is missing, you **must** create one. Before writing the test, **first, analyze other test files in the repository to determine the correct naming convention and testing style.** The new tests **must** validate the functionality described in this phase's tasks (`plan.md`).

3.  **Execute Automated Tests with Proactive Debugging:**
    - Before execution, you **must** announce the exact shell command you will use to run the tests.
    - **Example Announcement:** "I will now run the automated test suite to verify the phase. **Command:** `pnpm test:coverage`"
    - Execute the announced command.
    - If tests fail, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**. If the tests still fail after your second proposed fix, you **must stop**, report the persistent failure, and ask the user for guidance.

4.  **Propose a Detailed, Actionable Manual Verification Plan:**
    - **CRITICAL:** To generate the plan, first analyze `product.md`, `product-guidelines.md`, and `plan.md` to determine the user-facing goals of the completed phase.
    - You **must** generate a step-by-step plan that walks the user through the verification process, including any necessary commands and specific, expected outcomes.
    - The plan you present to the user **must** follow this format:

      **For a Frontend / UI Change:**

      ```
      The automated tests have passed. For manual verification, please follow these steps:

      **Manual Verification Steps:**
      1.  **Start the development server:** `pnpm dev`  (runs i18n codegen, then `vite dev`)
      2.  **Open your browser to:** `http://localhost:3000` (TanStack Start default)
      3.  **Confirm that you see:** The new user profile page, with the user's name and email displayed correctly.
      ```

      **For a Server Function / Database Change:**

      ```
      The automated tests have passed. For manual verification, please follow these steps:

      **Manual Verification Steps:**
      1.  **Start the dev server:** `pnpm dev`
      2.  **Navigate to the page that triggers the server function** (e.g., `/admin/users` → "Create User").
      3.  **Perform the action in the UI and confirm the result:** A toast notification appears and the new row appears in the list.
      4.  *(Optional)* **Verify the database state:** `docker compose exec postgres psql -U simak -d simak -c "SELECT ..."`
      ```

      SIMAK is a fullstack TanStack Start app — there is no separate REST backend. Server functions are invoked through the UI, not via `curl` endpoints.

5.  **Await Explicit User Feedback:**
    - After presenting the detailed plan, ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    - **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

6.  **Create Checkpoint Commit:**
    - Stage all changes. The checkpoint commit must contain at minimum the `plan.md` update from step 8 below; if additional test/code changes were made during verification, stage those too.
    - Perform the commit with a clear and concise message (e.g., `conductor(checkpoint): Checkpoint end of Phase X`).

7.  **Attach Auditable Verification Report using Git Notes:**
    - **Step 7.1: Draft Note Content:** Create a detailed verification report including the automated test command, the manual verification steps, and the user's confirmation.
    - **Step 7.2: Attach Note:** Use the `git notes` command and the full commit hash from the previous step to attach the full report to the checkpoint commit.

8.  **Get and Record Phase Checkpoint SHA:**
    - **Step 8.1: Get Commit Hash:** Obtain the hash of the _just-created checkpoint commit_ (`git log -1 --format="%H"`).
    - **Step 8.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    - **Step 8.3: Write Plan:** Write the updated content back to `plan.md`.

9.  **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message following the format `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

10. **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created, with the detailed verification report attached as a git note.

### Quality Gates

Before marking any task complete, verify ALL of the following. These mirror the Lefthook pre-commit and pre-push gates plus project-specific enforced rules.

- [ ] `pnpm test` passes (unit tests; excludes `tests/integration/**`)
- [ ] `pnpm test:coverage` meets thresholds — lines, statements, branches, **and** functions ≥80%
- [ ] `pnpm typecheck` passes (`tsc --noEmit --incremental --checkers 4`)
- [ ] `pnpm lint` passes — `oxlint .`, including the custom `simak-i18n/no-hardcoded` rule (no hardcoded English UI strings)
- [ ] `pnpm check:i18n` passes — i18n key parity between `locales/en.json` and `locales/id.json`
- [ ] No file in `src/`, `tests/`, or `scripts/` exceeds **500 lines** (enforced by `scripts/check-modularity.js` on commit; exempt: `*.gen.ts`, `src/i18n/types.ts`, `src/i18n/detect-locale.ts`, `scripts/generate-i18n-types.ts`)
- [ ] No `@ts-expect-error` directives added without a documented reason
- [ ] Server functions follow the **two-file split**: `src/server/<feature>.ts` (Zod schemas + `createServerFn` stubs) and `src/server/<feature>.server.ts` (handler implementations, never client-bundled)
- [ ] Type safety enforced (TypeScript strict; explicit return types on client-crossing server handlers)
- [ ] No security vulnerabilities introduced (input validation via Zod; SQL via Drizzle parameterized queries; ownership guards on all student/instructor server functions)
- [ ] Responsive layout verified in browser dev tools at mobile/tablet/desktop widths (if UI changed)
- [ ] Documentation updated if needed

## i18n Workflow

SIMAK is fully bilingual (English + Indonesian). i18n is a **first-class, enforced discipline** — not an afterthought.

### Adding or changing user-visible strings

1. **Add keys to `locales/en.json`** (the source of truth).
2. **Add the same keys to `locales/id.json`** with the Indonesian translation.
3. **Run `pnpm generate:i18n`** to regenerate `src/i18n/types.ts` and `src/i18n/detect-locale.ts` (these are generated — **never edit by hand**).
4. **Use `t('key')` in components** — never hardcode user-facing strings. The custom lint rule `simak-i18n/no-hardcoded` (in `lint-plugin.js`, loaded via `.oxlintrc.json`) flags hardcoded English text in JSX children and in `placeholder`/`aria-label`/`title`/`alt` attributes. Only the literal `DELETE` is allowlisted.
5. **Validate parity:** `pnpm check:i18n` (missing keys) and `pnpm check:i18n:unused` (unused keys). The unused-key check runs in the pre-push gate.

### Codegen timing

- `pnpm generate:i18n` runs **automatically before every `pnpm dev` and `pnpm build`** (see the `dev` and `build` scripts in `package.json`).
- For server-side i18n (e.g., localized email subjects, server-resolved error messages), use the shared server-side i18n helper — do not import the client `t()` into server code.

### When NOT to add keys

- Log messages, internal error messages, and developer-facing strings do not need i18n keys — only user-visible UI text does.

## Development Commands

### Setup

```bash
pnpm install                              # install dependencies
docker compose up -d                       # start local PostgreSQL (postgres:16-alpine, port 5432)
pnpm db:push                               # push schema to dev DB (drizzle-kit push)
pnpm db:seed                               # seed SuperAdmin user (reads .env via --env-file)
```

### Daily Development

```bash
pnpm dev                                   # i18n codegen + vite dev server (http://localhost:3000)
pnpm test                                  # vitest run (unit tests; excludes integration; xlsx tests run via `projects` config)
pnpm test:watch                            # watch mode (unit only, xlsx included via `projects`)
pnpm test:integration                      # opt-in integration tests only
pnpm test:coverage                         # unit + coverage report
pnpm lint                                  # oxlint . (includes simak-i18n/no-hardcoded)
pnpm format                                # oxfmt --write "*.{js,jsx,ts,tsx,css}"
pnpm typecheck                             # tsc --noEmit --incremental --checkers 4
pnpm check:i18n                            # i18n key parity EN↔ID
pnpm check:i18n:unused                     # show unused i18n keys
```

### Database

```bash
pnpm db:generate                           # generate Drizzle migration from schema
pnpm db:push                               # push schema to dev DB
pnpm db:migrate                            # run pending migrations
pnpm db:seed                               # seed SuperAdmin
```

### i18n

```bash
pnpm generate:i18n                         # regenerate src/i18n/types.ts + detect-locale.ts
pnpm check:i18n                            # validate EN↔ID key parity
pnpm check:i18n:unused                     # list unused keys
```

### Before Committing

The Lefthook pre-commit gate runs **sequentially** on staged files:

1. `oxlint --fix {staged_files}`
2. `oxfmt --write {staged_files}`
3. `node scripts/check-modularity.js {staged_files}` (500-line limit)

The pre-push gate runs:

```bash
pnpm typecheck && pnpm test:coverage
```

Run these manually before pushing if you want early feedback:

```bash
pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm check:i18n
```

## Testing Requirements

### Test Layout

- `tests/unit/` — unit tests, mirror the `src/` directory structure. Run by default.
- `tests/integration/` — integration tests (DB, concurrency, end-to-end flows). **Opt-in only** — excluded from `pnpm test`, `pnpm test:watch`, and the pre-push coverage run. Run explicitly with `pnpm test:integration`.
- xlsx-parsing tests run via the `projects` array in `vitest.config.ts` (xlsx project uses `threads` pool, rest uses `vmThreads`) — handled automatically, no script flags needed.

### Unit Testing

- Every module must have corresponding tests under `tests/unit/`.
- Default test environment is **`happy-dom`** (configured in `vitest.config.ts`).
- **Server-handler tests must override to Node:** add `/** @vitest-environment node */` as the first line of the test file.
- Tests import handlers directly via `@/server/*.server` and mock `@/server/auth`, `@/db/index`, plus external clients (`@/lib/storage`, Resend).
- **Mocking `@tanstack/react-start`:** when a server function uses `.inputValidator(Schema).handler(...)`, the test **must** mock the builder chain or the import fails. Canonical pattern (see `tests/unit/server/submissions.test.ts`):

  ```ts
  vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
  vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
  vi.mock('@tanstack/react-start', () => ({
    createServerFn: vi.fn().mockReturnValue({
      inputValidator: vi.fn().mockReturnThis(),
      handler: vi.fn().mockImplementation((fn) => fn),
    }),
  }));
  ```

- Use appropriate test setup/teardown (`beforeEach`/`afterEach`).
- Mock external dependencies (R2, Resend, DB).
- Test both success and failure cases.

### Integration Testing

- Run with `pnpm test:integration` — never runs unless explicitly invoked.
- Test complete user flows, DB transactions, concurrency (`SELECT ... FOR UPDATE`), and token-consumption atomicity.
- Requires the local PostgreSQL container (`docker compose up -d`).

### Responsive & Accessibility Testing

SIMAK is a responsive web app (not a native mobile app). The product targets WCAG 2.1 AA compliance (`product.md`).

- Verify layouts in browser dev tools at mobile (375px), tablet (768px), and desktop (1280px) widths.
- Keyboard navigation: every interactive element reachable and operable via Tab/Enter/Space.
- Screen-reader sanity check (VoiceOver / NVDA) on key flows (login, assignment submission, review).
- Color contrast meets WCAG AA; do not rely on color alone for status — pair with text/icon (the status badges already do this).
- Reduced-motion: respect the `prefers-reduced-motion` media query (the Settings Hub exposes a toggle).

## Code Review Process

### Self-Review Checklist

Before requesting review:

1. **Functionality**
   - Feature works as specified
   - Edge cases handled
   - Error messages are user-friendly and localized

2. **Code Quality**
   - Follows `conductor/code_styleguides/` (TypeScript, React, SQL, HTML/CSS)
   - DRY principle applied
   - Clear variable/function names
   - File ≤500 lines (`scripts/check-modularity.js`)

3. **Testing**
   - Unit tests comprehensive
   - Integration tests pass (if applicable)
   - Coverage ≥80% on all four metrics

4. **i18n**
   - No hardcoded user-visible strings (`simak-i18n/no-hardcoded` lint rule)
   - Keys added to both `locales/en.json` and `locales/id.json`
   - `pnpm check:i18n` passes; no new unused keys

5. **Security**
   - No hardcoded secrets (use `src/config/env.ts` Zod-validated env vars)
   - Input validation via Zod on every server function
   - SQL via Drizzle (parameterized — never raw string interpolation)
   - Ownership guards on student/instructor server functions
   - XSS: React escapes by default; avoid `dangerouslySetInnerHTML`

6. **Performance**
   - Database queries optimized (indexes on filtered/joined columns)
   - Images optimized (R2 uploads, not in-repo)
   - TanStack Query caching used for server state; polling only where needed (e.g., notification unread count)

7. **Responsive & Accessibility**
   - Layouts work at mobile/tablet/desktop widths
   - Keyboard-navigable; visible focus states
   - WCAG 2.1 AA color contrast
   - Status conveyed by text/icon, not color alone

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

### Examples

```bash
git commit -m "feat(auth): Add remember me functionality"
git commit -m "fix(posts): Correct excerpt generation for short posts"
git commit -m "test(comments): Add tests for emoji reaction limits"
git commit -m "style(a11y): Improve button focus visibility"
```

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing (`pnpm test`)
3. Code coverage ≥80% on lines, statements, branches, **and** functions (`pnpm test:coverage`)
4. `pnpm typecheck` passes
5. `pnpm lint` passes (including `simak-i18n/no-hardcoded`)
6. i18n keys added to both `en.json` and `id.json`; `pnpm check:i18n` passes; no new unused keys
7. No file in `src/`/`tests/`/`scripts/` exceeds 500 lines
8. Responsive layout verified at mobile/tablet/desktop widths (if UI changed)
9. Implementation notes / task summary added to `plan.md`
10. Changes committed with a properly-formatted message
11. Git note with task summary attached to the commit

## Emergency Procedures

### Critical Bug in Production

1. Create hotfix branch from main
2. Write failing test for the bug
3. Implement minimal fix
4. Test thoroughly (unit + relevant integration)
5. Deploy via the normal Docker → Coolify flow
6. Document in `plan.md`

### Data Loss

1. Stop all write operations
2. Restore from latest backup
3. Verify data integrity
4. Document incident
5. Update backup procedures

### Security Breach

1. Rotate all secrets immediately (`DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, R2 credentials)
2. Review access logs (audit_log table tracks actor, action, entity)
3. Patch vulnerability
4. Notify affected users (if any)
5. Document and update security procedures

## Deployment Workflow

SIMAK builds to a self-contained Node server via Docker and is hosted on Coolify (self-hosted PaaS on a VPS, with Traefik for auto-SSL).

### Pre-Deployment Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm test:coverage` meets thresholds (≥80% on all four metrics)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm check:i18n` passes
- [ ] Environment variables configured on Coolify (the 6 required: `DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`; plus `R2_*` for file uploads)
- [ ] Database migrations ready (`pnpm db:generate` committed)
- [ ] Backup created

### Build

```bash
pnpm build     # runs: i18n codegen → vite build → esbuild bundles for migrate.mjs + seed.mjs
```

Output lands in `.output/server/index.mjs` (multi-stage `docker/Dockerfile`).

### Deployment Steps

1. Merge feature branch to main
2. Build the Docker image (multi-stage; see `docker/Dockerfile`)
3. Deploy via Coolify (Traefik auto-proxies SSL)
4. Run pending migrations against the production DB (the image bundles `migrate.mjs`)
5. Verify deployment — hit the health endpoint / load the landing page
6. Test critical paths (login, create assignment, submit checkpoint, review)
7. Monitor Coolify logs for errors

### Post-Deployment

1. Monitor application logs (Coolify dashboard)
2. Check error rates
3. Gather user feedback
4. Plan next iteration

## Continuous Improvement

- Review workflow weekly
- Update based on pain points
- Document lessons learned
- Optimize for user happiness
- Keep things simple and maintainable

</protect>
